let utilities = require("./utilities");
let spinalCore = require("spinal-core-connectorjs");
const config = require("./config");

const {
  SpinalGraphService
} = require("spinal-env-viewer-graph-service");

function connectToHub() {
  const connect_opt =
    `http://${config.user}:${config.password}@${
    config.host
  }:${config.port}/`;

  return spinalCore.connect(connect_opt);
}

function Main(graph) {
  SpinalGraphService.setGraph(graph);

  utilities
    .getAllContextGeoGraphic(SpinalGraphService.getGraph())
    .then(contexts => {
      contexts.forEach(context => {
        utilities.getChildren(context.id.get(), 0).then(sites => {
          sites.forEach(site => {
            utilities.bindChildEndpoints(site.id.get(), 1);
          });
        });
      });
    });
}

spinalCore.load(connectToHub(), config.path, _file => {
  Main(_file.graph);
});