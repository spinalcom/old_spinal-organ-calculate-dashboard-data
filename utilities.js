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
  getSum(parentId, relationsName, endpointType) {

    return utilities._getChildrenEndpointsByType(parentId, relationsName,
      endpointType).then(promises => {


      return Promise.all(promises)
        .then(endpoints => {

          let sum = endpoints.reduce(function(param1, param2) {
            if (typeof param1.currentValue === "undefined")
              return param1 + param2.currentValue.get();

            return param1.currentValue.get() + param2.currentValue
              .get();
          })

          return typeof sum.currentValue === "undefined" ? sum : sum.currentValue
            .get()

        })
        .catch((err) => {
          console.log("error", err);
          return 0;
        })
    })
  },
  getAverage(parentId, relationsName, endpointType) {
    return SpinalGraphService.getChildren(parentId, relationsName).then(
      children => {
        return utilities.getSum(parentId, relationsName,
          endpointType).then(sum => {
          return sum / children.length;
        })


      })
  },
  getMin(parentId, relationsName, endpointType) {
    return utilities._getChildrenEndpointsByType(parentId, relationsName,
      endpointType).then(promises => {
      return Promise.all(promises).then(endpoints => {
        let min = endpoints[0].currentValue.get();

        for (let i = 1; i < endpoints.length; i++) {
          if (min > endpoints[i].currentValue.get())
            min = endpoints[i].currentValue.get()
        }
        return min;

      })
    })
  },
  getMax(parentId, relationsName, endpointType) {
    return utilities._getChildrenEndpointsByType(parentId, relationsName,
      endpointType).then(promises => {

      return Promise.all(promises).then(endpoints => {
        let max = endpoints[0].currentValue.get();

        for (let i = 1; i < endpoints.length; i++) {
          if (max < endpoints[i].currentValue.get())
            max = endpoints[i].currentValue.get()
        }
        return max;

      })
    })
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
              return endpoint.currentValue.get();
            })
        }

      })
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
    let relationsName = utilities.getRelationsByIndex(nodeType);

    return SpinalGraphService.getChildren(parentId, relationsName);
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
                nodeType, endpoint.type.get());
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
  calculateParentValue(nodeId, nodeType, endpointType) {

    utilities._getEndpointByType(nodeId,
      endpointType).then(endpoint => {

      let rules = this.getRule(nodeId);

      if (typeof rules !== "undefined") {
        switch (rules.rule.get()) {
          case dashboardVariables.CALCULATION_RULES.sum:
            this.getSum(nodeId,
              this.getRelationsByIndex(nodeType),
              endpointType).then(value => {
              endpoint.currentValue.set(value);
            })
            break;
          case dashboardVariables.CALCULATION_RULES.average:
            this.getAverage(nodeId,
              this.getRelationsByIndex(nodeType),
              endpointType).then(value => {
              endpoint.currentValue.set(value);
            })
            break;
          case dashboardVariables.CALCULATION_RULES.max:
            this.getMax(nodeId, this.getRelationsByIndex(nodeType),
              endpointType).then(value => {
              endpoint.currentValue.set(value);
            })
            break;
          case dashboardVariables.CALCULATION_RULES.min:
            this.getMin(nodeId, this.getRelationsByIndex(nodeType),
              endpointType).then(value => {
              endpoint.currentValue.set(value);
            })
            break;
          case dashboardVariables.CALCULATION_RULES.reference:
            this.getReference(nodeId, rules.ref, this.getRelationsByIndex(
              nodeType), endpointType).then(value => {
              endpoint.currentValue.set(value);
            })
            break;

        }
      } else {
        this.getAverage(nodeId,
          this.getRelationsByIndex(nodeType),
          endpointType).then(value => {
          endpoint.currentValue.set(value);
        })
      }

    })
  },
  _getEndpointByType(nodeId, endpointType) {

    return SpinalGraphService.getChildren(nodeId, [
      dashboardVariables.ENDPOINT_RELATION_NAME
    ]).then(endpointsNode => {

      let endpointPromises = [];

      for (let i = 0; i < endpointsNode.length; i++) {
        endpointPromises.push(endpointsNode[i].element.load());
      }

      return Promise.all(endpointPromises).then(endpoints => {
        // for (let i = 0; i < endpoints.length; i++) {
        //   const name = endpoints[i].type.get();
        //   if (name == endpointType) {
        //     return endpoints[i];
        //   }

        // }
        return endpoints.find(el => el.type.get() ===
          endpointType)
      })

    });
  },
  _getChildrenEndpointsByType(parentId, relationsName, endpointType) {
    return SpinalGraphService.getChildren(parentId, relationsName).then(
      children => {
        let promises = [];

        for (let i = 0; i < children.length; i++) {
          const child = children[i];
          promises.push(utilities._getEndpointByType(child.id.get(),
            endpointType));
        }

        return promises;

      });
  },
  getRule(nodeId) {
    return SpinalGraphService.getInfo(nodeId).dash_cal_rule;
  }

};

module.exports = utilities;