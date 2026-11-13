# Local database

Ask Righto keeps public energy plan data in PostgreSQL (the shared Azure instance in
production). Tests and development use any local PostgreSQL 14 or newer.

```sh
createdb askrighto_dev
export DATABASE_URL=postgres://localhost/askrighto_dev     # add user:password@ if needed
export DATABASE_SCHEMA=askrighto
npm run migrate                                             # creates the schema and tables
```

The login needs permission to create a schema in that database. The migration runner only
ever touches schemas named `askrighto` or `askrighto_*` and refuses anything else.

Run the database tests (each run uses a throwaway `askrighto_test_<random>` schema and drops it):

```sh
createdb askrighto_test
TEST_DATABASE_URL=postgres://localhost/askrighto_test npm test
```

Without `TEST_DATABASE_URL` the database tests are skipped. CI runs them against a
PostgreSQL 16 service container.

Settings: `DATABASE_URL`, `DATABASE_SCHEMA` (default `askrighto`), `ASKRIGHTO_DB_POOL_MAX`
(default 5), `ASKRIGHTO_DB_SSL=true` for a server that requires TLS. Credentials are secrets
and never go in the repository or the image.

To start over: drop the schema (`DROP SCHEMA askrighto CASCADE`) and run `npm run migrate` and
`npm run sync:energy`. Nothing in it is user data.
