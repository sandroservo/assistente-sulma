# DNS da Assistente Sulma

O painel da Sulma só abre quando o domínio aponta para o servidor correto.

## O que fazer

1. Acesse o painel onde você gerencia o DNS do domínio da Sulma.

2. Crie ou edite o registro **A**:
   - **Tipo:** A
   - **Nome/Host:** `@` (raiz) ou o subdomínio escolhido (ex.: `sulma`)
   - **Valor/Destino:** IP do servidor
   - **TTL:** 300 ou 3600 (opcional)

3. Salve e aguarde a propagação (alguns minutos até algumas horas).

4. Depois de propagar, teste:
   ```bash
   dig +short seu-dominio.com
   ```
   O resultado deve ser o IP do servidor. Em seguida abra `https://seu-dominio.com`.

## Se usar Cloudflare

- Crie ou edite o registro **A** para o host escolhido → IP do servidor.
- Pode deixar o proxy (nuvem laranja) ligado; em **SSL/TLS** use **Full** ou **Full (strict)**.
- Se mesmo assim não abrir, desative o proxy (nuvem cinza) temporariamente para testar direto no servidor.
