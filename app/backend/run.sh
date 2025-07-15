#!/bin/sh
cd /lzcapp/pkg/content/backend
ls
apk update
apk add nodejs npm
npm install
npm run start