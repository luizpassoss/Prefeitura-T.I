# Proposta de melhorias (UX/UI) – Sistema Prefeitura T.I

## Objetivo
Entregar uma experiência **funcional, minimalista e profissional**, reduzindo ruído visual, padronizando estilos e reforçando hierarquia da informação.

---

## 1) Identidade visual minimalista
### Paleta de cores enxuta (Light/Dark)
**Light**
- Fundo: `#F8FAFC`
- Painéis: `#FFFFFF`
- Texto principal: `#0F172A`
- Texto secundário: `#64748B`
- Borda: `#E2E8F0`
- Acento (primário): `#2563EB`
- Acento hover: `#1D4ED8`

**Dark**
- Fundo: `#0B0B0D`
- Painéis: `#141418`
- Texto principal: `#E4E4E7`
- Texto secundário: `#A1A1AA`
- Borda: `#27272A`
- Acento: `#93C5FD`
- Acento hover: `#BFDBFE`

> Diretriz: usar **uma única cor de acento** e evitar “feedback por cor” excessivo. Use **peso tipográfico e ícones** para indicar prioridade.

### Tipografia
- Fonte única: **Inter** (já usada no sistema).
- Escala recomendada (já próxima dos tokens atuais):
  - `--font-xs: 12px`
  - `--font-sm: 14px`
  - `--font-md: 16px`
  - `--font-lg: 20px`
  - `--font-xl: 24px`

> Diretriz: evitar mistura de famílias (“Segoe UI” em algumas áreas). Padronizar toda a aplicação para Inter.

### Espaçamento e ritmo
- Manter tokens `--space-*` para margem/padding.
- Reforçar a consistência entre cards, headers e botões.

---

## 2) Componentes base (kit minimalista)
### Botões
- **Primário**: fundo sólido do acento, texto branco, raio médio, sombra leve.
- **Secundário**: fundo transparente, borda cinza, texto escuro.
- **Ghost**: sem borda, texto com peso médio.

### Inputs
- Bordas sutis, foco com `outline` suave.
- Placeholder com opacidade leve.
- Sem bordas duplas ou efeitos pesados.

### Cards/Painéis
- Fundo branco (ou `panel` no dark).
- Borda sutil + sombra leve.
- Espaçamento interno fixo.

---

## 3) Notificações (mais profissionais)
### Diretrizes
- Sem cores fortes para prioridade.
- Ícones neutros e consistentes (info/alerta/sucesso).
- Texto claro e objetivo.
- Ações simples: “Abrir”, “Ver”, “Corrigir”.

### Estrutura sugerida
- Cabeçalho com título + ações discretas.
- Lista com cartões leves, hover com elevação sutil.
- Badge neutra, sem vermelho forte.

---

## 4) Hierarquia e layout
### Sidebar
- Tipografia firme, mas discreta.
- Ícones padronizados.
- Menu principal com destaque apenas na aba ativa.

### Cabeçalho das telas
- Título maior.
- Subtítulo em texto secundário.
- Ações principais sempre no topo direito.

### Listas e tabelas
- Cabeçalho claro.
- Linhas com altura confortável.
- Hover leve para leitura.

---

## 5) Acessibilidade e foco
- Manter `:focus-visible` visível.
- Contraste suficiente entre `text` e `panel`.
- Botões e inputs com áreas de clique maiores.

---

## 6) Melhorias funcionais sugeridas
### Curto prazo
- Busca global rápida.
- Filtros salvos (por usuário).
- Itens “recentes”.

### Médio prazo
- Dashboard inicial com indicadores.
- Histórico de alterações (audit log).
- Exportação guiada (exportar filtros atuais).

### Longo prazo
- Permissões granulares por perfil.
- Integração com sistemas externos (ex.: protocolos internos).

---

## 7) Checklist de implementação
- [ ] Padronizar família tipográfica.
- [ ] Aplicar paleta reduzida.
- [ ] Revisar botões e inputs.
- [ ] Ajustar espaçamentos e bordas.
- [ ] Refinar notificações.
- [ ] Documentar padrões (mini design system).

---

## Resultado esperado
Uma interface **limpa, funcional e coesa**, com foco em **clareza, minimalismo e consistência** — melhorando a percepção profissional do sistema e reduzindo ruído visual.
