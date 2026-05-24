# Manastack

MTG minigames where you earn **mana** from wins, spend it on **Commander booster packs**, and build your **collection**.

## Setup

Card data is linked from the sibling `website/mtg` project:

```bash
npm install
npm run ensure-data   # links public/data from ../website/mtg/public/data
npm run dev
```

If card data is missing, run `npm run build:data` in `../website/mtg` first.

## Game loop

1. **Minigames** — Art Guess & Unscramble (copied from Commander Helper). Win = +1 mana.
2. **Shop** — Open a booster pack for 10 mana. Get 10 random Commander-legal cards (1 foil guaranteed, no duplicate non-foils).
3. **Inventory** — View your collection and organize cards into showcase folders.

Progress is saved in localStorage.
