FROM node:22-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --production
COPY src ./src
EXPOSE 3000
CMD node -e "\
const fs=require('fs');\
const cfg={\
  jwtSecret: process.env.JWT_SECRET||'secret',\
  db:{connection:{host:process.env.DB_HOST||'localhost',user:process.env.DB_USER||'root',password:process.env.DB_PASSWORD||'',database:process.env.DB_NAME||'pizza',connectTimeout:60000},listPerPage:10},\
  factory:{url:'https://pizza-factory.cs329.click',apiKey:process.env.FACTORY_API_KEY||''},\
  metrics:{\
    source:process.env.METRICS_SOURCE||'jwt-pizza-service',\
    endpointUrl:process.env.METRICS_ENDPOINT_URL||'',\
    accountId:process.env.METRICS_ACCOUNT_ID||'',\
    apiKey:process.env.METRICS_API_KEY||''\
  },\
  logging:{\
    source:process.env.LOGGING_SOURCE||'jwt-pizza-service',\
    endpointUrl:process.env.LOGGING_ENDPOINT_URL||'',\
    accountId:process.env.LOGGING_ACCOUNT_ID||'',\
    apiKey:process.env.LOGGING_API_KEY||''\
  }\
};\
fs.writeFileSync('/app/src/config.js','module.exports='+JSON.stringify(cfg));\
" && node src/index.js
