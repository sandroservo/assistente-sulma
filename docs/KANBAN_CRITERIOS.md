# Critérios de Movimentação do Kanban - Assistente Sulma

> **Autor:** Sandro Servo  
> **Site:** https://cloudservo.com.br  
> **Última atualização:** 14/08/2026

---

## Visão Geral

O Kanban organiza os interessados no funil de captação da Unisulma. A movimentação acontece de **duas formas**:

1. **Automática** — A Sulma (IA) ou o sistema detecta sinais na conversa e move o lead.
2. **Manual** — O atendente arrasta o card no Kanban ou altera o status no chat.

---

## Funil principal

```
Novo → Entender → Orientar → Qualificar → Registrar → Conduzir para matrícula
```

| Status | Coluna | Quando |
|---|---|---|
| `NOVO` | Novo | Primeira mensagem recebida |
| `ENTENDER` | Entender | Conversa começou: descobrir o que a pessoa busca |
| `ORIENTAR` | Orientar | Explicar cursos, campus, modalidades e processo seletivo |
| `QUALIFICAR` | Qualificar | Curso, prazo, vestibular/ENEM, mensalidade ou bolsa definidos |
| `REGISTRAR` | Registrar | Quer se inscrever, enviar documentos ou abrir a ficha |
| `CONDUZIR_MATRICULA` | Conduzir para matrícula | Pagamento, documentos enviados ou matrícula em andamento |
| `PERDIDO` | Perdido | Desistiu ou não tem interesse |

Status operacionais (não aparecem como coluna do funil): `LEAD_FRIO`, `AGUARDANDO_RESPOSTA`, `HUMANO_SOLICITADO`, `HUMANO_EM_ATENDIMENTO`.

---

## Transições automáticas

### 1. NOVO → ENTENDER

- **Quando:** o lead já trocou **2 ou mais mensagens**.
- **Objetivo:** separar quem só mandou “oi” de quem já está em conversa.

### 2. → ORIENTAR

- **Quando:** pergunta sobre cursos, campus, “como funciona”, grade, duração, EAD/presencial, transferência.

### 3. → QUALIFICAR

- **Quando:** fala de curso específico, mensalidade, bolsa, vestibular, ENEM, turno, formas de pagamento.

### 4. → REGISTRAR

- **Quando:** pede para se inscrever, enviar documentos, abrir ficha ou iniciar matrícula.

### 5. → CONDUZIR_MATRICULA

- **Quando:** confirma matrícula, pagamento, documentos enviados ou aprovação.

### 6. Qualquer → PERDIDO

- **Quando:** deixa claro que não tem interesse, desiste ou diz que já estudou em outro lugar.

### 7. Qualquer → HUMANO_SOLICITADO

- **Quando:** pede atendente humano. O bot para de responder (`ownerType = human`).

---

## Transições manuais e de sistema

- **Arrastar no Kanban:** grava o status da coluna de destino.
- **Devolver ao bot:** volta o lead para `ENTENDER`.
- **Pagamento Asaas confirmado:** `CONDUZIR_MATRICULA`.
- **Pagamento vencido:** volta para `QUALIFICAR`.

O score só **avança** no funil (não regride). Status protegidos não são sobrescritos automaticamente: `CONDUZIR_MATRICULA`, `PERDIDO`, `HUMANO_*`, `AGUARDANDO_RESPOSTA`, `LEAD_FRIO`.

---

## Fluxo visual

```
                         NOVO
                           │  2+ mensagens
                           ▼
                       ENTENDER
                           │  dúvidas sobre cursos / processo
                           ▼
                       ORIENTAR
                           │  curso, valor, vestibular, bolsa
                           ▼
                      QUALIFICAR
                           │  quer se inscrever / documentos
                           ▼
                       REGISTRAR
                           │  pagamento / matrícula
                           ▼
                 CONDUZIR PARA MATRÍCULA
```
