const {
  SpinalGraphService
} = require("spinal-env-viewer-graph-service");

let find = async function(id, relationNames, predicate) {
  if (typeof predicate !== "function") {
    throw new Error("predicate must be a function");
  }

  let argNode = SpinalGraphService.getInfo(id);

  let seen = new Set([argNode]);
  let promises = [];
  let nextGen = [argNode];
  let currentGen = [];
  let found = [];

  while (nextGen.length) {
    currentGen = nextGen;
    promises = [];
    nextGen = [];

    for (let node of currentGen) {
      // promises.push(node.getChildren(relationNames));
      promises.push(SpinalGraphService.getChildren(node.id.get(),
        relationNames));

      let predicated = predicate(node);

      if (predicated) {
        found.push(node);
      }
    }

    // eslint-disable-next-line no-await-in-loop
    let childrenArrays = await Promise.all(promises);

    for (let children of childrenArrays) {
      for (let child of children) {
        if (!seen.has(child)) {
          nextGen.push(child);
          seen.add(child);
        }
      }
    }
  }

  return found;
}

module.exports = find;