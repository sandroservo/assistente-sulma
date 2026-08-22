# Segurança e conformidade operacional

- credenciais RabbitMQ e Evolution somente por ENV/secret store;
- usuário RabbitMQ de aplicação sem permissão administrativa desnecessária;
- management UI restrita por firewall/VPN;
- TLS se RabbitMQ atravessar rede não confiável;
- payload RabbitMQ usa IDs, não conteúdo completo quando possível;
- retenção da DLQ deve ser definida e monitorada;
- suppression/opt-out é revalidado no worker;
- campanhas devem respeitar consentimento e regras aplicáveis da plataforma;
- limites e pausas devem proteger capacidade e conformidade, não imitar comportamento humano para burlar mecanismos de detecção;
- mascarar telefone em logs operacionais quando possível.
