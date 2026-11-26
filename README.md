# Ecológica Verde - Links Hub

Página oficial de links da **Ecológica Verde**, com design arquitetural escuro + verde esmeralda (Optimus Edition), suporte multilíngue (PT/EN/ES/RU), trilha sonora aleatória e wallpapers dinâmicos.

## Recursos

- **Design Arquitetural Matte:** grade Swiss com linhas `1px`, blocos em grid `2x4` sem numeração, contraste de raio (`0px` estrutural + botões pill) e esfera 3D generativa em glifos ASCII no fundo.
- **Descoberta Automática de Wallpapers (`assets/wallpaper/`):** basta adicionar novos arquivos numerados (`11.jpg`, `12.jpg`, `13.jpg`, etc., em `.jpg`, `.png` ou `.webp`) na pasta `assets/wallpaper/`. Eles são identificados automaticamente e alternados de forma aleatória a cada seleção mantendo o overlay verde escuro padrão.
- **Trilha Sonora Aleatória e Automática (`assets/music/`):** sorteio aleatório a cada abertura do site (sem ordem fixa), com tentativa automática de autoplay e desbloqueio no primeiro toque/clique. Novos arquivos (`OST5.mp3`, `OST6.m4a`, etc.) colocados em `assets/music/` são detectados automaticamente sem editar o código.
- **GitHub Actions:**
  - `.github/workflows/update-followers.yml` executa `update-followers.js` a cada hora para atualizar membros do Discord e seguidores do BlueSky em `followers.json`.
  - `.github/workflows/update-media.yml` executa `update-media.js` automaticamente quando músicas ou wallpapers são adicionados/alterados no GitHub, mantendo `assets/media-manifest.json` sincronizado para o GitHub Pages.
