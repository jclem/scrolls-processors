import { assert } from "@jclem/assert";

const path = assert(Bun.argv.at(2))
const file = Bun.file(path)
const content = await file.json()
console.log(content);