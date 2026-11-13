# World of Sxan

RPG multiplayer isométrico de fantasia medieval com visual pré-renderizado (modelos 3D transformados em imagens, como no Diablo II), direto no navegador.

**Jogar:** https://djsxan.github.io/eldmar-online/

## Como jogar com os amigos

1. Escolha nome, cor do brasão, vocação e armadura (skin).
2. Um jogador clica em **Criar um novo reino** — ele vira o *anfitrião* (o mundo roda no navegador dele, que precisa ficar aberto).
3. O anfitrião clica em **Copiar convite** e manda o link aos amigos.
4. Os amigos abrem o link e clicam em **Entrar no reino**.

## Vocações

| Vocação | Papel | Habilidades (1–4) | Aptidão |
|---|---|---|---|
| Cavaleiro | Tank | Golpe Brutal, Grito de Guerra, Redemoinho, Muralha de Ferro | Pele de Aço (−30% de dano) |
| Atirador | Dano à distância | Tiro Duplo, Flecha Perfurante, Chuva de Flechas, Passo Ágil | Olho de Águia (20% crítico) |
| Mago | Magia / Cura | Bola de Fogo, Nova de Gelo, Luz Curativa, Chuva de Meteoros | Mente Arcana (mana 2x) |

Cada vocação tem 3 skins (Comum, Rara, Lendária) e cada ataque tem sua própria animação, com braços, pernas e arma articulados.

## Controles

| Tecla | Ação |
|---|---|
| W A S D / setas / clique no chão | Andar (joystick na tela no celular) |
| Clique no inimigo / X / Espaço | Mirar (ataca sozinho quando o alvo está no alcance) |
| 1 2 3 4 | Habilidades (botões redondos no canto direito) |
| Q / E | Poção de vida / mana |
| F (segurar) | Reanimar aliado caído |
| G | Carregar / soltar aliado caído |
| R | Desistir quando caído (renasce na capela) |
| Roda do mouse | Zoom |
| Enter / Esc | Chat / cancelar |

## O mundo

- **Cidadela de Eldmar** (zona protegida): fosso com pontes, muralhas com caminho de ronda, torres, torre de menagem com salão superior, capela, mercado, empório, taverna, estábulo, forja, quartel e pátio de treino.
- **Andares fluidos**: rampas de pedra levam às muralhas e ao salão — o personagem sobe de verdade, sem teletransporte.
- **Caído (downed)**: aliados podem reanimar (F) ou carregar (G) até a capela. A Luz Curativa também reanima.
- **Contratos** com a Capitã Varn, **lâmina afiada** com o ferreiro Hrodgar, **bênção** na capela, **hidromel** na taverna.
- Uma cachoeira desce da montanha a noroeste e forma um rio que atravessa o mapa.
- Regiões: Campos ★, Bosque Sombrio ★★, Pântano Pútrido ★★, Colinas de Ossos ★★★, Acampamento Orc ★★★, Terras Selvagens ★★★★.
- Ciclo de dia e noite de 12 minutos; fora de combate, vida e mana se regeneram.

## Como funciona

- Sem servidor: os navegadores se conectam direto via WebRTC ([PeerJS](https://peerjs.com/)), com um canal rápido para posições.
- Toda a arte é gerada por código: personagens, monstros e cenário são modelos 3D (Three.js) fotografados no ângulo do mapa e guardados em cache como imagens. O chão tem texturas com relevo iluminadas por um sol fixo.

| Arquivo | Conteúdo |
|---|---|
| `js/config.js` | Classes, skins, habilidades, monstros, missões |
| `js/world.js` | Mapa, cidadela, rio, rampas |
| `js/net.js` | Rede |
| `js/server.js` | Regras do jogo (roda no anfitrião) |
| `js/pixel.js` | Pincel de pixel art (personagens) |
| `js/paint.js` | Pincel de pintura digital (cenário) |
| `js/sprites.js` | Esqueleto dos heróis, animações, monstros |
| `js/props.js` | Árvores, castelo, construções, cachoeira |
| `js/terrain.js` | Chão e água |
| `js/render.js` | Cenário, luz, efeitos, correção de cor |
| `js/game.js` | Controles, interface, tela inicial |
