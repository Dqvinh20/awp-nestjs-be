**Requirements for local dev**
- File ```.env.development``` must be created in root folder (use for local development). See .env for reference
- MongoDB installed
- NodeJS installed
- Yarn installed

First, install dependencies
```
yarn install
```

Start server
```
yarn start
```

Start server in development mode

```
yarn start:dev
```

#### Default link:
- Swagger: http://localhost:3000/api-docs
- Json Schema for importing to Postman: http://localhost:3000/api-docs-json
- API Base URL: http://localhost:3000/api

#### References
- [NestJS Project Boilerplate Tutorial](https://viblo.asia/p/setup-boilerplate-cho-du-an-nestjs-phan-1-team-co-nhieu-thanh-vien-env-joi-husky-commitlint-prettier-dockerizing-EbNVQxG2LvR)