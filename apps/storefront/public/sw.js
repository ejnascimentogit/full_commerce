// Service worker mínimo: só existe para o navegador oferecer "Instalar app". Não guarda nada em cache: toda requisição
// vai direto para a rede, então a loja e o painel nunca mostram uma versão velha nem dados antigos.
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()));
self.addEventListener("fetch", () => {});
