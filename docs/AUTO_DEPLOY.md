# Автоматический деплой на существующий EC2

После разовой настройки каждый `git push origin main` запускает GitHub Actions: `npm ci`, lint, тесты, сборку, затем AWS Systems Manager Run Command вызывает существующий `update.sh` на EC2 с SHA проверенного коммита. Проверка падает — работающий сервер не перезапускается. SSH-порт для GitHub открывать не нужно, постоянные AWS-ключи в GitHub не хранятся. Комнаты пока находятся в памяти и при успешном деплое прервутся.

Workflow уже лежит в `.github/workflows/deploy.yml`. Пока две переменные репозитория не заданы, проверка запускается, а шаг деплоя пропускается.

## Разовая настройка в AWS

1. **Дайте EC2 доступ к Systems Manager.** В IAM → Roles создайте роль типа **AWS service → EC2** и прикрепите только AWS-managed policy `AmazonSSMManagedInstanceCore`. В EC2 → Instances → выберите игровой инстанс → Actions → Security → **Modify IAM role** прикрепите эту роль. Перезапуск EC2 не нужен. Убедитесь, что `amazon-ssm-agent` работает (`sudo systemctl status amazon-ssm-agent`). В Systems Manager → Fleet Manager → Managed nodes инстанс должен стать **Online**. Инстансу нужен исходящий доступ к сервисам SSM через интернет; входящий SSH для этого не нужен.
2. **Создайте GitHub OIDC provider.** IAM → Identity providers → Add provider → **OpenID Connect**: Provider URL `https://token.actions.githubusercontent.com`, Audience `sts.amazonaws.com`. Если provider уже есть, используйте его.
3. **Создайте отдельную IAM-роль для GitHub Actions** типа **Web identity** с этим provider и audience. Назовите, например, `CableGameGitHubDeploy`. После создания откройте Trust relationships → Edit trust policy и замените условие на приведённое ниже. Замените `YOUR_ACCOUNT_ID` на 12-значный AWS Account ID. Постоянные GitHub ID этого репозитория: владелец `202847951`, репозиторий `1395076506`. Роль может принять только workflow из `main` этого репозитория.

```json
{
  "Version": "2012-10-17",
  "Statement": [{
    "Effect": "Allow",
    "Principal": {
      "Federated": "arn:aws:iam::YOUR_ACCOUNT_ID:oidc-provider/token.actions.githubusercontent.com"
    },
    "Action": "sts:AssumeRoleWithWebIdentity",
    "Condition": {
      "StringEquals": {
        "token.actions.githubusercontent.com:aud": "sts.amazonaws.com",
        "token.actions.githubusercontent.com:sub": "repo:Allkhvnn@202847951/CablePullingGame@1395076506:ref:refs/heads/main"
      }
    }
  }]
}
```

4. В этой же IAM-роли → Permissions → Add permissions → Create inline policy → JSON вставьте политику ниже. Замените `YOUR_ACCOUNT_ID` и `YOUR_INSTANCE_ID` (например, `i-...`) значениями из карточки **вашего** EC2. Политика позволяет отправить стандартную shell-команду только на этот инстанс и прочитать итог выполнения. Она не даёт GitHub прав создавать или удалять инстансы.

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "DeployOnlyToGameInstance",
      "Effect": "Allow",
      "Action": "ssm:SendCommand",
      "Resource": [
        "arn:aws:ec2:eu-north-1:YOUR_ACCOUNT_ID:instance/YOUR_INSTANCE_ID",
        "arn:aws:ssm:eu-north-1::document/AWS-RunShellScript"
      ]
    },
    {
      "Sid": "ReadDeploymentResult",
      "Effect": "Allow",
      "Action": "ssm:GetCommandInvocation",
      "Resource": "*"
    }
  ]
}
```

## Разовая настройка в GitHub

В репозитории GitHub → Settings → Secrets and variables → Actions → вкладка **Variables** → New repository variable добавьте:

| Имя | Значение |
| --- | --- |
| `AWS_DEPLOY_ROLE_ARN` | ARN роли `CableGameGitHubDeploy` из IAM (`arn:aws:iam::...:role/CableGameGitHubDeploy`) |
| `EC2_INSTANCE_ID` | ID игрового EC2 (`i-...`), тот же, что в IAM policy |

Это идентификаторы, не пароли. Не добавляйте AWS access keys или SSH `.pem` в репозиторий. Регион `eu-north-1` указан в workflow, потому что текущий инстанс запущен там.

После этого в GitHub → Actions → **Test and deploy to EC2** → **Run workflow** выберите `main`. Убедитесь, что `verify` и `deploy` зелёные. Если `deploy` показывает **Skipped**, проверьте две переменные репозитория. Если шаг AWS сообщает `AssumeRoleWithWebIdentity` — проверьте trust policy и точный `sub`. Если SSM пишет `TargetNotConnected`, проверьте роль EC2, статус SSM Agent и Managed nodes. Ошибка `AccessDenied` означает ошибку IAM policy или ID инстанса.

После успеха откройте `https://ВАШ_ДОМЕН.cloudfront.net/health` и саму игру. Для проверки автообновления следующий коммит отправьте в `main`: workflow запустится сам. Ручная команда `update.sh` остаётся запасным способом. Несколько подряд отправленных коммитов обрабатываются последовательно. Не отправляйте код в `main` во время активной партии, пока комнаты не сохраняются на диск.

AWS: [SSM Agent на Amazon Linux 2023](https://docs.aws.amazon.com/systems-manager/latest/userguide/ami-preinstalled-agent.html), [Run Command на EC2](https://docs.aws.amazon.com/systems-manager/latest/userguide/run-command.html), [GitHub OIDC trust](https://docs.aws.amazon.com/IAM/latest/UserGuide/id_roles_create_for-idp_oidc.html). GitHub: [OIDC для AWS](https://docs.github.com/en/actions/how-tos/secure-your-work/security-harden-deployments/oidc-in-aws), [стоимость Actions](https://docs.github.com/en/actions/reference/runners/github-hosted-runners). AWS указывает, что Run Command на EC2 не требует дополнительной платы; стандартные GitHub-hosted runners для публичного репозитория тоже бесплатны. Стоимость самого EC2 и CloudFront проверяйте отдельно.
