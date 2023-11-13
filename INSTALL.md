# Installation

**Prerequisites:**

- Node.js:

  - Install Node.js: [Installation guide](https://nodejs.org/en/download/package-manager/)

- MongoDB:

  - Install MongoDB Community Edition: [Installation guide](https://www.mongodb.com/docs/manual/administration/install-community/)

## Initial database

1. Open the terminal.
2. Run command `mongosh`
3. Inside mongosh, run the following commands:

```shell
use admin
db.createUser({
  "user": "root",
  "pwd": "password",
  "roles": [
    "userAdmin"
  ]
})
db.createCollection("awp_project")
```

4. Open the db folder in the project.<br/> Has 2 files:
   - archive.gz
   - restore.sh
  
Double click on ```restore.sh``` and wait for the process to finish.

## Run the project
- Install dependencies: `yarn`
- Start the server: `yarn start`
- Check server started: `http://localhost:3000/api-docs/` (username: admin, password: admin) - Swagger UI