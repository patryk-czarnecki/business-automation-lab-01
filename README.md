# Business Automation Lab #1

Laboratorium API zamówień: Express, Prisma i PostgreSQL. Integracja z systemem
zewnętrznym jest symulowana. Projekt nie jest jeszcze gotowy do publicznego
wdrożenia produkcyjnego (m.in. brak autoryzacji).

## Wymagania

- Node.js **24.22.1** (plik `.nvmrc`; testowana linia 24), npm 11.
  Node wykonuje TypeScript wygenerowanego klienta Prisma bez dodatkowego builda.
- Docker Engine z Docker Compose v2, wolne porty 55432 (baza) i 3000 (API).
- Dostęp do registry.npmjs.org, binaries.prisma.sh i rejestru Docker.

## Uruchomienie od zera

W terminalu, z katalogu projektu:

```sh
git clone https://github.com/patryk-czarnecki/business-automation-lab-01.git
cd business-automation-lab-01
# Jeśli używasz nvm:
nvm install
nvm use
npm ci
cp .env.example .env
npm run db:up
npm run prisma:generate
npm run db:migrate
npm run db:status
npm start
```

Nie nadpisuj istniejącego `.env`. Przykład zawiera wyłącznie jawne dane lokalnego
laboratorium. Compose tworzy bazę `business_lab` i wystawia PostgreSQL tylko na
127.0.0.1:55432. Nie wpisuj tu adresu prywatnej ani produkcyjnej bazy.
`db:up` czeka na gotowość PostgreSQL; `db:migrate` nakłada zapisane migracje,
również przy kolejnych uruchomieniach. Proces API działa na pierwszym planie.
Do pracy z automatycznym restartem użyj `npm run dev`.

W drugim terminalu:

```sh
curl --fail http://localhost:3000/health
curl --fail http://localhost:3000/api/orders
curl --fail -X POST http://localhost:3000/api/orders \
  -H 'Content-Type: application/json' \
  -d '{"externalId":"DEMO-001","customerName":"Example Company","customerEmail":"demo@example.com","amount":12.34,"currency":"PLN"}'
```

Oczekiwane: health zwraca `{"status":"ok"}`, lista początkowo `{"orders":[]}`,
utworzenie zwraca 201 i zamówienie `RECEIVED`. Z odpowiedzi skopiuj liczbowe `order.id`:

```sh
curl --fail -X POST http://localhost:3000/api/orders/1/process
```

Zastąp `1` rzeczywistym ID. Oczekiwane 200, stan `COMPLETED`.
Powtórzenie identycznego POST tworzącego zwraca 200 z istniejącym zamówieniem;
ten sam externalId z innymi danymi zwraca 409.

Symulator: externalId kończące się `-FAIL` daje trwały błąd; `-RETRY` daje
pierwszy błąd tymczasowy. Pierwsze przetworzenie trzeba uruchomić endpointem.
Worker co 10 s sprawdza zaległe ponowienia: opóźnienia polityki to 30 i 120 s.
Pamięć symulatora resetuje się wraz z procesem. Health potwierdza działanie HTTP,
nie gotowość bazy. Więcej ręcznych przykładów: `requests/orders.http`.

## Testy i CI

```sh
npm run db:up
npm test
# Osobno:
npm run test:unit
npm run test:integration
```

Używamy wbudowanego `node:test`, `assert` i `fetch`, bez dodatkowego frameworka.
Testy jednostkowe sprawdzają walidację, politykę retry i symulator.
Integracyjne uruchamiają prawdziwy serwer HTTP i PostgreSQL: zapis/odczyt,
deduplikację i konflikt, błędne dane/ID, równoległe przetwarzanie, trwały błąd,
terminy retry oraz współbieżne cykle workera. Sprawdzają również rekordy prób
w bazie, nie tylko odpowiedzi HTTP. Nie dowodzą efektów w prawdziwym ERP ani
poprawności wszystkich przeplotów wielu procesów.

Runner ignoruje aplikacyjny `DATABASE_URL` i nie ładuje `.env` do wyboru bazy.
Domyślne połączenie administracyjne to
`postgresql://lab:lab@127.0.0.1:55432/postgres`.
Każdy przebieg tworzy losową bazę `lab_test_<uuid>`, generuje klienta, nakłada
wszystkie migracje i usuwa tę bazę w `finally`, także po nieudanych testach.
Nie czyści bazy developerskiej. Konto lokalne musi mieć uprawnienie CREATEDB.
Dla innego lokalnego portu ustaw w powłoce `TEST_DATABASE_URL`; adresy zdalne
i parametry URL są odrzucane. Nie używaj tunelu do prywatnej bazy.
Nagłe SIGKILL może pozostawić bazę testową — usuń wtedy wyłącznie bazę
`lab_test_...` należącą do zakończonego przebiegu.

CI w `.github/workflows/ci.yml` działa na push i pull request: Node z .nvmrc,
`npm ci`, PostgreSQL 17 i `npm test`. Błędy testów blokują job.
`npm audit --omit=dev` jest raportem doradczym (nie blokuje job), ponieważ
aktualizacje zależności z audytu należą do kolejnego etapu. Wymaganie zielonego
CI przed scaleniem trzeba włączyć osobno w regułach ochrony gałęzi GitHub.

## Prisma i codzienna praca

- `npm run prisma:generate` — generacja klienta, bez wymaganej bazy/shadow.
- `npm run db:migrate` — wdrożenie istniejących migracji, wymaga DATABASE_URL.
- `npm run db:status` — stan migracji.
- `npm run db:dev -- --name nazwa_zmiany` — tworzenie migracji podczas rozwoju.
  Lokalne konto Compose może tworzyć bazę shadow automatycznie.
  Jeżeli ustawiasz SHADOW_DATABASE_URL ręcznie, utwórz **odrębną, pustą bazę**
  (np. `docker compose exec postgres createdb -U lab business_lab_shadow`).
  Prisma może czyścić shadow; nigdy nie wskazuj tam bazy z ważnymi danymi.
  Shadow nie jest wymagane przez generate ani deploy.
- `npm run db:down` — zatrzymanie bazy, zachowuje wolumen z danymi.
- Ctrl+C zatrzymuje API. Pełne graceful shutdown jest poza tym etapem.

Po zmianie schematu generuj klienta ponownie. Katalog `generated/prisma`,
`node_modules` i `.env` są ignorowane przez Git. Nie ma osobnego kroku build.

## Zakres etapu A09–A10

Dodano powtarzalny start, testy i CI, bez zmiany logiki biznesowej.
Pozostałe problemy audytu wymagają osobnych poprawek: m.in. odzyskiwanie
utkniętych prób, idempotencja rzeczywistego partnera, granice kwot/ID,
egzekwowanie limitów ręcznych retry, autoryzacja i podatności zależności.
Zielone testy opisują sprawdzone scenariusze i nie oznaczają naprawy tych luk.
