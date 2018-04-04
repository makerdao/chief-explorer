const fs = require('fs');

fs.writeFileSync('./build/CNAME', fs.readFileSync('./src/CNAME'));
