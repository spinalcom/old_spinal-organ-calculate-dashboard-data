const {
  SpinalGraphService
} = require("spinal-env-viewer-graph-service");

const {
  dashboardVariables
} = require("spinal-env-viewer-dashboard-standard-service");

const geographicService = require(
    "spinal-env-viewer-context-geographic-service")
  .default.constants;



let utilities = {
  getRelationsByIndex(type) {
    let index = geographicService.GEOGRAPHIC_TYPES_ORDER.indexOf(type);
    return geographicService.GEOGRAPHIC_RELATIONS_ORDER.slice(index);
  },
  _calculateSum(endpoints) {
    let sum = 0;

    for (let i = 0; i < endpoints.length; i++) {
      sum += endpoints[i].currentValue.get();
    }

    return sum;

  },
  getSum(parentId, relationName, endpointName) {
    return SpinalGraphService.getChildren(parentId, relationName).then(
      async children => {
        let promises = [];

        for (let i = 0; i < children.length; i++) {
          const child = children[i];
          promises.push(utilities._getEndpointByName(child.id.get(),
            endpointName));
        }

        return utilities._calculateSum(await Promise.all(promises));

      });
  },
  getAverage(parentId, relationName, endpointName) {
    return SpinalGraphService.getChildren(parentId, relationName).then(
      async children => {
        let sum = await utilities.getSum(parentId, relationName,
          endpointName);

        return sum / children.length;
      })
  },
  _getEndpointByName(nodeId, endpointName) {

    return SpinalGraphService.getChildren(nodeId, [
      dashboardVariables.ENDPOINT_RELATION_NAME
    ]).then(endpointsNode => {

      let endpointPromises = [];

      for (let i = 0; i < endpointsNode.length; i++) {
        endpointPromises.push(endpointsNode[i].element.load());
      }

      return Promise.all(endpointPromises).then(endpoints => {
        for (let i = 0; i < endpoints.length; i++) {
          const name = endpoints[i].name.get();
          if (name == endpointName) {
            return endpoints[i];
          }

        }
      })

    });
  },
  getAllContextGeoGraphic(graph) {

    return SpinalGraphService.getChildren(graph.info.id.get(), [
        "hasContext"
      ])
      .then(contexts => {
        let res = [];
        contexts.forEach(context => {
          if (context.type.get() == geographicService.CONTEXT_TYPE) {
            res.push(context);
          }
        });

        return res;
      });
  },
  getChildren(parentId, nodeType) {
    let relationName = utilities.getRelationsByIndex(nodeType);

    return SpinalGraphService.getChildren(parentId, relationName);
  },
  bindChildEndpoints(parentId, nodeType) {

    SpinalGraphService.getChildren(parentId, utilities.getRelationsByIndex(
        nodeType))
      .then(children => {
        children.forEach(async child => {
          let endpoints = await SpinalGraphService.getChildren(
            child.id
            .get(), [dashboardVariables.ENDPOINT_RELATION_NAME]
          );

          endpoints.forEach(async endpointModel => {
            let endpoint = await endpointModel.element.load();

            endpoint.currentValue.bind(() => {
              utilities.calculateParentValue(parentId,
                nodeType, endpoint.name.get());
            })
          })

          // if (next < geographicService.GEOGRAPHIC_RELATIONS_ORDER
          //   .length) {
          utilities.bindChildEndpoints(child.id.get(),
            child.type.get());
          // }

        })
      }, (error) => {
        console.log(error);

      })

  },
  async calculateParentValue(nodeId, nodeType, endpointName) {

    let endpoint = await utilities._getEndpointByName(nodeId,
      endpointName);

    if (endpoint && endpoint.dataType.get() !== "Boolean") {
      endpoint.currentValue.set(await utilities.getAverage(nodeId,
        utilities.getRelationsByIndex(nodeType),
        endpointName));
    } else {
      console.log("boolean");
    }
  }
};

module.exports = utilities;