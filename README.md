# Brætspilsvalg

Fast webapp til vores månedlige brætspilsafstemninger.

## Sådan fungerer den

- Faste deltagere: Martin, Carsten, Nordbek, Peter og Lauge
- Hver afstemning knyttes til en konkret spilledato
- Man stemmer på alle de spil, man gerne vil spille
- Spil vises med coverbilleder hentet via BoardGameGeek
- Resultatet er skjult, indtil alle fem har stemt
- Når alle fem har stemt, lukkes grundafstemningen automatisk
- Ved delt førsteplads starter appen en omstemning mellem de førende spil
- I en omstemning vælger hver person præcis ét spil
- Hvis en omstemning stadig ender lige, starter næste runde automatisk blandt de nye ligespillere
- Resultat og historik viser, hvem der har stemt på hvad
- Historik og statistik bevares på tværs af afstemninger

## Ny spilledato / ny afstemning

Afstemninger styres i `config/polls.json`. Behold gamle poll-objekter, tilføj et nyt, og sæt `activePollId` til det nye id. Feltet `date` bruger formatet `YYYY-MM-DD`.

Spil kan tilføjes med `id`, `name` og et BoardGameGeek `bggId`.

## Data

Stemmer gemmes i Upstash Redis. Appen understøtter begge Vercel-navngivninger:

- `UPSTASH_REDIS_REST_URL` + `UPSTASH_REDIS_REST_TOKEN`
- `KV_REST_API_URL` + `KV_REST_API_TOKEN`
