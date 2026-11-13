# Eldmar Online

RPG multiplayer isométrico de fantasia medieval em pixel art, direto no navegador.

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

Cada vocação tem 3 skins: Comum, Rara e Lendária.

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
| F (segurar) | Reanimar aliado caído |
| G | Carregar / soltar aliado caído |
| R | Desistir quando caído (renasce na capela) |

## O mundo

- **Ruínas de Eldmar** (zona protegida): castelo em ruínas com escadas para as muralhas e a torre (2 andares), Capela da Aurora, Empório do Borin, Taverna do Javali e a Capitã Varn, que dá contratos de caça (missões).
- **Caído (downed)**: ao perder toda a vida você fica caído por 30s. Um aliado pode te reanimar (F) ou te carregar (G) até a capela. A Luz Curativa do Mago também reanima.
- Uma cachoeira desce da montanha a noroeste e forma um rio que atravessa o mapa.
- Fora de combate, vida e mana se regeneram sozinhas.
- Regiões de dificuldade: Campos ★, Bosque Sombrio ★★ (norte), Pântano Pútrido ★★ (leste), Colinas de Ossos ★★★ (sul), Acampamento Orc ★★★ (oeste), Terras Selvagens ★★★★ (litoral).
- Ciclo de dia e noite de 12 minutos (igual para todos).
- O personagem fica salvo no navegador.

## Como funciona

- Sem servidor: os navegadores se conectam direto via WebRTC usando [PeerJS](https://peerjs.com/).
- Hospedado de graça no GitHub Pages.
- Toda a arte é pixel art gerada por código e guardada em cache; o mundo é desenhado em baixa resolução e ampliado.
- Rede otimizada: cada jogador só recebe o que está perto, por um canal rápido sem fila.

| Arquivo | Conteúdo |
|---|---|
| `js/world.js` | Mapa, zonas, vilarejo |
| `js/config.js` | Classes, habilidades, monstros, itens (balanceamento) |
| `js/net.js` | Rede |
| `js/server.js` | Regras do jogo (roda no anfitrião) |
| `js/pixel.js` | Pincel de pixel art e cache de sprites |
| `js/sprites.js` | Personagens, skins, monstros, ícones |
| `js/props.js` | Árvores, castelo, construções, cachoeira |
| `js/terrain.js` | Chão pré-desenhado e água animada |
| `js/render.js` | Cenário, luz, partículas, efeitos |
| `js/game.js` | Controles, interface, tela inicial |
