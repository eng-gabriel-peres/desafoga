/**
 * Dicionário de lojas e MCCs para dar categoria às compras do banco. Os
 * padrões rodam sobre a descrição em maiúsculas e sem acento.
 */
import type { Categoria } from "@/lib/finance";

export const LOJAS: [RegExp, Categoria][] = [
  // Comida pronta: delivery, restaurantes, lanchonetes, padarias
  [/IFOOD|RAPPI|AIQFOME|ZE DELIVERY|UBER\s?EATS|99\s?FOOD|JAMES DELIVERY/, "Comida pronta"],
  [/MC\s?DONALDS|MCDONALD|BURGER KING|BK BRASIL|SUBWAY|HABIB|GIRAFFAS|BOB.?S|OUTBACK|SPOLETO|CHINA IN BOX|KFC|STARBUCKS|PIZZA|LANCHONETE|RESTAURANTE|PADARIA|PANIFICADORA|SORVETERIA|CAFETERIA|BAR E |CHURRASC/, "Comida pronta"],
  // Mercado
  [/CARREFOUR|ASSAI|ATACADAO|PAO DE ACUCAR|EXTRA HIPER|MERCADO EXTRA|DIA BRASIL|SUPERMERC|HORTIFRUTI|SONDA|GUANABARA|ZAFFARI|BIG BOMPRECO|NACIONAL SUPER|ANGELONI|TENDA ATACADO|MAKRO|SAMS CLUB|OXXO|MINUTO PAO|ACOUGUE|SACOLAO|QUITANDA|FEIRA/, "Mercado"],
  // Farmácia
  [/DROGASIL|DROGA RAIA|RAIA DROG|PAGUE MENOS|DROGARIA|FARMACIA|PANVEL|ULTRAFARMA|DROGAO|NISSEI|SAO JOAO FARM|VENANCIO/, "Farmácia"],
  // Roupa
  [/RENNER|RIACHUELO|C\s?&\s?A|CEA MODAS|MARISA|HERING|ZARA|SHEIN|NETSHOES|CENTAURO|DECATHLON|YOUCOM|AREZZO|CALCADOS|NIKE|ADIDAS|DAFITI|PERNAMBUCANAS/, "Roupa"],
  // Lazer: streaming, jogos, academia, cinema, eventos
  [/NETFLIX|SPOTIFY|DISNEY|HBO|MAX\.COM|PRIME VIDEO|AMAZON PRIME|DEEZER|YOUTUBE|GLOBOPLAY|PARAMOUNT|APPLE\.COM|STEAM|PLAYSTATION|XBOX|NINTENDO|SMART\s?FIT|BLUEFIT|ACADEMIA|CINEMARK|CINEPOLIS|INGRESSO|SYMPLA|TICKET/, "Lazer"],
  // Casa
  [/LEROY MERLIN|TOK\s?STOK|ETNA|CAMICADO|CASAS BAHIA|MAGAZINE LUIZA|MAGALU|PONTO FRIO|MADEIRA MADEIRA|MOBLY|TELHANORTE|C\s?&\s?C|HOME CENTER|CASA E VIDEO|DPASCHOAL/, "Casa"],
  // Presente
  [/FLORICULTURA|CACAU SHOW|KOPENHAGEN|BOTICARIO|O BOTICARIO|NATURA|EUDORA|PRESENTE/, "Presente"],
];

/** Contas da casa: não são compra emocional (viram sugestão de conta fixa). */
export const CONTAS_DE_CONSUMO =
  /ENEL|LIGHT S|ELETROPAULO|CEMIG|COPEL|CELESC|COELBA|CPFL|EQUATORIAL|ENERGISA|NEOENERGIA|SABESP|CEDAE|COPASA|SANEPAR|EMBASA|COMGAS|NATURGY|CONDOMINIO|ALUGUEL|VIVO|CLARO|TIM CELULAR|OI S\.?A|NET SERVICOS|INTERNET|IPTU|IPVA/;

/** Códigos de categoria do comerciante (MCC) mais comuns. */
export const MCC_PARA_CATEGORIA: Record<number, Categoria> = {
  5411: "Mercado",
  5422: "Mercado",
  5441: "Mercado",
  5451: "Mercado",
  5462: "Comida pronta",
  5499: "Mercado",
  5812: "Comida pronta",
  5813: "Comida pronta",
  5814: "Comida pronta",
  5912: "Farmácia",
  5122: "Farmácia",
  5651: "Roupa",
  5691: "Roupa",
  5699: "Roupa",
  5661: "Roupa",
  5311: "Casa",
  5712: "Casa",
  5719: "Casa",
  5722: "Casa",
  5200: "Casa",
  5251: "Casa",
  7832: "Lazer",
  7922: "Lazer",
  7941: "Lazer",
  7997: "Lazer",
  5815: "Lazer",
  5816: "Lazer",
  5817: "Lazer",
  5818: "Lazer",
  5992: "Presente",
  5947: "Presente",
};

/** Categorias da Pluggy (descrição em inglês) para as do Desafoga. */
export const CATEGORIA_DA_PLUGGY: [RegExp, Categoria][] = [
  [/groceries|supermarket/i, "Mercado"],
  [/food delivery|restaurant|food and drinks|eating out/i, "Comida pronta"],
  [/pharmac|drugstore/i, "Farmácia"],
  [/clothing|apparel/i, "Roupa"],
  [/leisure|entertainment|streaming|digital services|gaming|sports/i, "Lazer"],
  [/housing|home|furniture|electronics/i, "Casa"],
  [/gift|donation/i, "Presente"],
];
