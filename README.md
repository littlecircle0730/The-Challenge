# The-Challenge


# RUN
Server: `python server.py  `
Client: `npx vite`
Client page on: http://localhost:5173/

# For webTransport app on browser
'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' \
  --origin-to-force-quic-on=localhost:4433 \
  --ignore-certificate-errors-spki-list=pJ2BdYvZEgR3Tbli8/mA+lwu+sGiJAjeBrkY3NMVpCk= \
  --user-data-dir=/tmp/chrome-wt-profile \
  http://localhost:5173

# Test
python -m unittest Nimble_Challenge/src/tests/test_server.py


<!-- # for credential for webTransport
brew install mkcert
mkcert -install  
mkcert localhost -->

<!-- npm install --save-dev jest babel-jest @babel/preset-env jest-environment-jsdom
npm install --save-dev identity-obj-proxy
npm install --save-dev yargs-parser
pip install opencv-python
pip install aioquic
pip install aiortc -->
