import parallel from "parallel-es";

parallel.from([1, 2, 3]).map(value => value * 2).then(result => console.log(result));