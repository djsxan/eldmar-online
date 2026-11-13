# Eldmar Online

RPG multiplayer isométrico de fantasia medieval que roda direto no navegador.

**Jogar:** https://djsxan.github.io/eldmar-online/

## Como jogar com os amigos

1. Escolha nome, cor do brasão e vocação.
2. Um jogador clica em **Criar um novo reino** — ele vira o *anfitrião* (o mundo roda no navegador dele, então ele precisa manter o jogo aberto).
3. O anfitrião clica em **Copiar convite** e manda o link aos amigos.
4. Os amigos abrem o link e clicam em **Entrar no reino**.

## Vocações

| Vocação | Papel | Habilidades (1–4) | Aptidão |
|---|---|---|---|
| Cavaleiro | Tank | Golpe Brutal, Grito de Guerra, Redemoinho, Muralha de Ferro | Pele de Aço (−30% de dano) |
| Atirador | Dano à distância | Tiro Duplo, Flecha Perfurante, Chuva de Flechas, Passo Ágil | Olho de Águia (20% crítico) |
| Mago | Magia / Cura | Bola de Fogo, Nova de Gelo, Luz Curativa, Chuva de Meteoros | Mente Arcana (mana 2x) |

## Controles

| Tecla | Ação |
|---|---|
| W A S D / setas / clique no chão | Andar |
| Clique no monstro / Espaço | Mirar (ataca sozinho quando o alvo está no alcance) |
| 1 2 3 4 | Habilidades |
| Q / E | Poção de vida / mana |
| Roda do mouse | Zoom |
| Enter | Chat |
| Esc | Cancelar alvo / fechar diálogo |

## O mundo

- **Vilarejo de Eldmar** (zona protegida): Templo da Aurora (bênção e renascimento), Empório do Borin (poções) e Taverna do Javali (hidromel, ensopado e boatos).
- Fora de combate, vida e mana se regeneram sozinhas.
- Regiões de dificuldade: Campos ★, Bosque Sombrio ★★ (norte), Pântano Pútrido ★★ (leste), Colinas de Ossos ★★★ (sul), Acampamento Orc ★★★ (oeste), Terras Selvagens ★★★★ (litoral).
- Ciclo de dia e noite de 12 minutos (igual para todos).
- O personagem fica salvo no navegador.

## Como funciona

- Sem servidor: os navegadores se conectam direto via WebRTC usando [PeerJS](https://peerjs.com/).
- Hospedado de graça no GitHub Pages.
- Toda a arte é desenhada por código (canvas), sem imagens.

| Arquivo | Conteúdo |
|---|---|
| `js/world.js` | Mapa, zonas, vilarejo |
| `js/config.js` | Classes, habilidades, monstros, itens (balanceamento) |
| `js/net.js` | Rede |
| `js/server.js` | Regras do jogo (roda no anfitrião) |
| `js/sprites.js` | Personagens, monstros, ícones |
| `js/render.js` | Cenário, luz, partículas, efeitos |
| `js/game.js` | Controles, interface, tela inicial |
