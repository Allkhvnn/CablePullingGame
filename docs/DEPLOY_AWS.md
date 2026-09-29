# Публикация игры на AWS

Этот вариант использует одну EC2-машину для Node.js и Nginx. CloudFront выдаёт постоянный HTTPS-адрес `*.cloudfront.net` и передаёт WebSocket на ту же машину. Своё доменное имя не требуется. В репозитории подготовлены скрипт первого запуска, конфигурация Nginx и служба systemd; ресурсы AWS ещё не созданы.

## Сначала проверьте стоимость

«Бесплатно» зависит от даты регистрации и типа аккаунта. Для **нового Free account plan** AWS даёт начальные кредиты и закрывает бесплатный план через 6 месяцев или после исчерпания кредитов, в зависимости от того, что раньше. После закрытия сервер перестанет работать, пока владелец не перейдёт на платный план. Для старого аккаунта право на EC2 Free Tier могло истечь. Не выбирайте платный план, если не готовы к оплате. Смотрите статус в AWS Console → Billing and Cost Management → Free Tier / Credits.

Выбирайте только тип EC2 с пометкой **Free tier eligible** для вашего аккаунта и региона, один инстанс, один диск `gp3` на 16 ГБ. Для `t3.micro` установите CPU credits **Standard**, чтобы исключить платные всплески Unlimited. Публичный IPv4 и диск тоже входят в расчёт Free Tier или расходуют кредиты — проверьте это в Billing. Сам CloudFront можно оформить на **Free flat-rate plan ($0/месяц)**; он не делает EC2 бесплатным. Не создавайте Load Balancer, NAT Gateway и другие ресурсы для этой схемы.

Документация AWS: [Free Tier](https://aws.amazon.com/free/free-tier-faqs/), [EC2 Free Tier по дате создания аккаунта](https://docs.aws.amazon.com/AWSEC2/latest/UserGuide/ec2-free-tier-usage.html), [планы CloudFront](https://aws.amazon.com/cloudfront/pricing/).

## 1. Запустите EC2

1. В AWS Console откройте EC2 в подходящем регионе. Выберите **Launch instance**, имя `cable-pulling-game`, образ **Amazon Linux 2023 (x86_64)** и тип **t3.micro**, только если он отмечен как доступный по вашему Free Tier. Укажите один диск `gp3` на 16 ГБ.
2. Выберите default VPC и публичную subnet с включённым auto-assign public IPv4. Для входа создайте ключ SSH и сохраните файл `.pem` только у себя. В security group разрешите входящий **HTTP 80** из интернета и **SSH 22** только с вашего IP (`My IP`). Порты 3001 и 5174 наружу не открывайте.
3. В **Advanced details → User data** вставьте полное содержимое [bootstrap.sh](../deploy/aws/bootstrap.sh). Этот скрипт устанавливает пакеты, создаёт swap на 2 ГБ для сборки, клонирует публичный репозиторий, выполняет `npm ci` и сборку, запускает приложение и Nginx. При запуске он записывает подробный лог в `/var/log/cable-pulling-bootstrap.log`. Не вставляйте в User data пароли или AWS-ключи.
4. Перед нажатием **Launch instance** ещё раз проверьте выбранный тип, диск, IP и условия Free Tier в аккаунте. Запуск EC2 создаёт потенциально платный ресурс вне бесплатного плана.

После запуска дождитесь завершения User data (несколько минут). В EC2 Console скопируйте **Public IPv4 DNS**. Проверка по прямому адресу на данном этапе: `http://PUBLIC_IPV4_DNS/health` должно вернуть `{"ok":true}`. Если не отвечает, подключитесь по SSH и выполните:

```bash
sudo tail -n 100 /var/log/cable-pulling-bootstrap.log
sudo systemctl status cable-pulling.service nginx.service
curl -f http://127.0.0.1/health
```

Можно закрепить IP за инстансом с помощью Elastic IP, чтобы адрес origin не менялся после остановки/запуска EC2. Перед выделением IP проверьте его условия оплаты в вашем аккаунте. Без постоянного IP при смене публичного DNS потребуется обновить origin в CloudFront.

## 2. Создайте CloudFront

1. В AWS Console → CloudFront создайте **distribution** и выберите **Free flat-rate plan**, если он доступен аккаунту. В качестве origin выберите **Other / Custom origin** и вставьте `Public IPv4 DNS` EC2 **без** `http://` и пути. Origin protocol: **HTTP only**, port **80**.
2. Viewer protocol: **Redirect HTTP to HTTPS**. Для default behavior выберите managed cache policy **CachingDisabled** и managed origin request policy **AllViewer**. Эта политика передаёт заголовки WebSocket; кэширование динамического состояния отключено. Дополнительный `path pattern` для `/ws` не нужен — default behavior обслуживает оба вида трафика.
3. Дождитесь статуса **Deployed**. Откройте выданный адрес вида `https://d123example.cloudfront.net/`. Браузер автоматически будет использовать `wss://d123example.cloudfront.net/ws`.

Проверьте `https://ВАШ_ДОМЕН.cloudfront.net/health`, создайте комнату и откройте приглашение в другом браузере или на телефоне через мобильную сеть. Пройдите один раунд и убедитесь, что оба видят одинаковый результат. Рекомендации AWS: [WebSocket в CloudFront](https://docs.aws.amazon.com/AmazonCloudFront/latest/DeveloperGuide/distribution-working-with.websockets.html), [Origin request policy AllViewer](https://docs.aws.amazon.com/AmazonCloudFront/latest/DeveloperGuide/using-managed-origin-request-policies.html).

После проверки можно ограничить входящий HTTP 80 на EC2 управляемым AWS prefix list для CloudFront origin-facing вместо `0.0.0.0/0`. До этого прямой HTTP-адрес инстанса тоже доступен; отправляйте игрокам именно HTTPS-ссылку CloudFront. Связь CloudFront → EC2 в этой простой схеме идёт по HTTP. Для чувствительных данных и долгой эксплуатации потребуется собственный домен с TLS на origin либо другая защищённая схема.

## Обновления и ограничения

После нового коммита в `main` подключитесь к EC2 как `ec2-user` и выполните:

```bash
bash /opt/cable-pulling-game/deploy/aws/update.sh
```

Скрипт получает обновления, пересобирает приложение, перезапускает службу и проверяет `/health`. Во время перезапуска все активные комнаты теряются: сейчас они хранятся в памяти одного процесса. Клиент покажет возможность создать новую комнату, если старая исчезла. Не обновляйте сервер во время партии.

Игра работает на **одном** EC2-инстансе; несколько экземпляров без общей базы не смогут совместно обслуживать комнаты. Клиент и WebSocket обслуживаются одним Node-сервером через Nginx. Диск, IP и инстанс остаются ресурсами аккаунта, пока вы их не удалите. Когда тест закончится, удалите CloudFront distribution, освободите Elastic IP (если выделяли), завершите EC2 и удалите оставшийся EBS-диск; проверьте Billing.
