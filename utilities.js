const {
  SpinalGraphService
} = require("spinal-env-viewer-graph-service");

const {
  dashboardVariables
} = require("spinal-env-viewer-dashboard-standard-service");

const geographicService = require(
    "spinal-env-viewer-context-geographic-service")
  .default.constants;

const find = require("./find");

const {
  SpinalBmsDevice,
  SpinalBmsEndpoint,
  SpinalBmsEndpointGroup
} = require("spinal-model-bmsnetwork");


let utilities = {
  getRelationsByIndex(type) {
    let index = geographicService.GEOGRAPHIC_TYPES_ORDER.indexOf(type);

    return geographicService.GEOGRAPHIC_RELATIONS_ORDER.slice(index);
  },
  getSum(parentId, relationsName, endpointType) {
    return utilities
      ._getChildrenEndpointsByType(parentId, relationsName, endpointType)
      .then(promises => {
        return Promise.all(promises)
          .then(endpoints => {
            endpoints = endpoints.filter(el => el !== undefined);

            let sum = endpoints.reduce(function(param1, param2) {
              if (typeof param1.currentValue === "undefined")
                return param1 + param2.currentValue.get();

              return param1.currentValue.get() + param2.currentValue.get();
            }, 0);

            return typeof sum.currentValue === "undefined" ?
              sum :
              sum.currentValue.get();
          })
          .catch(err => {
            console.log("error", err);
            return 0;
          });
      });
  },
  getAverage(parentId, relationsName, endpointType) {
    return SpinalGraphService.getChildren(parentId, relationsName).then(
      children => {
        return utilities
          .getSum(parentId, relationsName, endpointType)
          .then(sum => {
            return sum / children.length;
          });
      }
    );
  },
  getMin(parentId, relationsName, endpointType) {
    return utilities
      ._getChildrenEndpointsByType(parentId, relationsName, endpointType)
      .then(promises => {
        return Promise.all(promises).then(endpoints => {
          let min = endpoints[0].currentValue.get();

          for (let i = 1; i < endpoints.length; i++) {
            if (min > endpoints[i].currentValue.get())
              min = endpoints[i].currentValue.get();
          }
          return min;
        });
      });
  },
  getMax(parentId, relationsName, endpointType) {
    return utilities
      ._getChildrenEndpointsByType(parentId, relationsName, endpointType)
      .then(promises => {
        return Promise.all(promises).then(endpoints => {
          let max = endpoints[0].currentValue.get();

          for (let i = 1; i < endpoints.length; i++) {
            if (max < endpoints[i].currentValue.get())
              max = endpoints[i].currentValue.get();
          }
          return max;
        });
      });
  },
  getReference(parentId, reference, relationsName, endpointType) {
    return SpinalGraphService.getChildren(parentId, relationsName).then(
      children => {
        let ref;
        for (let index = 0; index < children.length; index++) {
          const child = children[index];
          if (child.id.get() === reference) ref = child;
        }

        if (ref) {
          return this._getEndpointByType(ref.id.get(), endpointType).then(
            endpoint => {
              if (endpoint) {
                return endpoint.currentValue.get();
              }

              return 0;
            }
          );
        }
      }
    );
  },
  getAllContextGeoGraphic(graph) {
    return SpinalGraphService.getChildren(graph.info.id.get(), [
      "hasContext"
    ]).then(contexts => {
      let res = [];
      contexts.forEach(context => {
        if (context.type.get() == geographicService.CONTEXT_TYPE) {
          res.push(context);
        }
      });

      return res;
    });
  },
  bindChildEndpoints(parentId, nodeType) {
    SpinalGraphService.getChildren(
      parentId,
      utilities.getRelationsByIndex(nodeType)
    ).then(
      children => {
        children.forEach(async child => {
          let endpoints;

          if (child.type.get() !== geographicService.EQUIPMENT_TYPE) {
            endpoints = await SpinalGraphService.getChildren(child.id
              .get(), [
                dashboardVariables.ENDPOINT_RELATION_NAME
              ]);
          } else {
            endpoints = await this._getAllEndpointOfBimObject(child.id
              .get());
          }

          endpoints.forEach(async endpointModel => {
            let endpoint = await endpointModel.element.load();

            endpoint.currentValue.bind(() => {
              utilities.calculateParentValue(
                parentId,
                nodeType,
                endpoint.type.get()
              );
            });
          });

          utilities.bindChildEndpoints(child.id.get(), child.type.get());
        });
      },
      error => {
        console.log(error);
      }
    );
  },
  calculateParentValue(nodeId, nodeType, endpointType) {
    utilities._getEndpointByType(nodeId, endpointType).then(endpoint => {
      let rules = this.getRule(nodeId);

      if (typeof rules !== "undefined" && endpoint) {
        switch (rules.rule.get()) {
          case dashboardVariables.CALCULATION_RULES.sum:
            this.getSum(
              nodeId,
              this.getRelationsByIndex(nodeType),
              endpointType
            ).then(value => {
              endpoint.currentValue.set(value);
            });
            break;
          case dashboardVariables.CALCULATION_RULES.average:
            this.getAverage(
              nodeId,
              this.getRelationsByIndex(nodeType),
              endpointType
            ).then(value => {
              endpoint.currentValue.set(value);
            });
            break;
          case dashboardVariables.CALCULATION_RULES.max:
            this.getMax(
              nodeId,
              this.getRelationsByIndex(nodeType),
              endpointType
            ).then(value => {
              endpoint.currentValue.set(value);
            });
            break;
          case dashboardVariables.CALCULATION_RULES.min:
            this.getMin(
              nodeId,
              this.getRelationsByIndex(nodeType),
              endpointType
            ).then(value => {
              endpoint.currentValue.set(value);
            });
            break;
          case dashboardVariables.CALCULATION_RULES.reference:
            this.getReference(
              nodeId,
              rules.ref,
              this.getRelationsByIndex(nodeType),
              endpointType
            ).then(value => {
              endpoint.currentValue.set(value);
            });
            break;
        }
      } else if (endpoint) {
        this.getAverage(
          nodeId,
          this.getRelationsByIndex(nodeType),
          endpointType
        ).then(value => {
          endpoint.currentValue.set(value);
        });
      }
    });
  },
  _getEndpointByType(nodeId, endpointType) {
    let nodeType = SpinalGraphService.getInfo(nodeId).type.get();

    if (nodeType !== geographicService.EQUIPMENT_TYPE) {
      return SpinalGraphService.getChildren(nodeId, [
        dashboardVariables.ENDPOINT_RELATION_NAME
      ]).then(endpointsNode => {
        let endpointPromises = [];

        for (let i = 0; i < endpointsNode.length; i++) {
          endpointPromises.push(endpointsNode[i].element.load());
        }

        return Promise.all(endpointPromises).then(endpoints => {
          return endpoints.find(el => el.type.get() === endpointType);
        });
      });
    } else {
      return this._getAllEndpointOfBimObject(nodeId).then(async endpoints => {
        let x = await endpoints
          .find(async el => {
            let t = await el.element.load();

            return t.type.get() === endpointType;
          })
          .element.load();

        return x;
      });
    }
  },
  _getChildrenEndpointsByType(parentId, relationsName, endpointType) {
    return SpinalGraphService.getChildren(parentId, relationsName).then(
      children => {
        let promises = [];

        for (let i = 0; i < children.length; i++) {
          const child = children[i];
          promises.push(
            utilities._getEndpointByType(child.id.get(), endpointType)
          );
        }

        return promises;
      }
    );
  },
  getRule(nodeId) {
    return SpinalGraphService.getInfo(nodeId).dash_cal_rule;
  },
  _getAllEndpointOfBimObject(bimObjectId) {
    return find(
      bimObjectId,
      [
        "hasEndPoint",
        SpinalBmsDevice.relationName,
        SpinalBmsEndpoint.relationName,
        SpinalBmsEndpointGroup.relationName
      ],
      node => {
        return node.type.get() === SpinalBmsEndpoint.nodeTypeName;
      }
    );

  }
};

module.exports = utilities;