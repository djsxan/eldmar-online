# Eldmar Online

RPG multiplayer isométrico que roda direto no navegador.

## Como jogar

1. Abra o site do jogo.
2. Um jogador clica em **Criar sala nova** — ele vira o *host* (o mundo roda no navegador dele, então ele precisa ficar com o jogo aberto).
3. O host clica em **Copiar link** e manda para os amigos (ou passa o código da sala).
4. Os amigos abrem o link e clicam em **Entrar**.

## Controles

| Tecla | Ação |
|---|---|
| W A S D / setas / clique no chão | Andar |
| Clique no monstro | Atacar (o personagem persegue sozinho) |
| Espaço | Mirar no monstro mais próximo |
| 1 ou F | Bola de fogo (alcance 5) |
| 2 ou H | Curar |
| Enter | Chat |
| Esc | Cancelar alvo |

A cidade no centro é zona protegida: monstros não entram e a vida regenera mais rápido.
Quanto mais longe da cidade, mais fortes os monstros (Rato → Gosma → Lobo → Esqueleto → Orc).
O nível do personagem fica salvo no navegador.

## Como funciona

- Sem servidor: os navegadores se conectam direto via WebRTC usando [PeerJS](https://peerjs.com/).
- Hospedado de graça no GitHub Pages.
- `js/world.js` mapa · `js/net.js` rede · `js/render.js` desenho · `js/game.js` regras e controles.
