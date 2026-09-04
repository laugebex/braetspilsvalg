# Brætspilsvalg

En lille fast webapp til månedlige brætspilsafstemninger.

## Funktioner

- Samme URL hver måned
- Stem på alle de spil, man gerne vil spille
- En person kan ændre sin stemme ved at bruge samme navn igen
- Live-resultat med **navnene på alle, der har stemt på hvert spil**
- Resultatet af en åben afstemning vises først, når man selv har stemt
- Historik pr. måned
- Statistik for spil og personer over tid
- Spillisten styres i `config/polls.json`, så den kan vedligeholdes direkte via GitHub/chat

## Data

Stemmer gemmes i Upstash Redis via Vercel Marketplace. Krævede miljøvariabler:

- `UPSTASH_REDIS_REST_URL`
- `UPSTASH_REDIS_REST_TOKEN`

Vercel/Upstash kan injicere dem automatisk, når integrationen kobles til projektet.

## Ny måned

Tilføj et nyt poll-objekt i `config/polls.json`, behold de gamle objekter, og sæt `activePollId` til den nye måned. Historikken bevares dermed.

`played` er en liste af game-id'er, der faktisk blev spillet den måned.
