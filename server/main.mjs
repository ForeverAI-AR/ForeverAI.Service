import weaveDrive from "./weavedrive.js";
import { readFileSync } from "fs"
import Module from "./AOS.js";
import { createInterface } from 'readline/promises';
import { stdin as input, stdout as output } from 'process';

const rl = createInterface({ input, output });

const wasm = readFileSync('./AOS.wasm')
const AdmissableList =
  [
    "dx3GrOQPV5Mwc1c-4HTsyq0s1TNugMf7XfIKJkyVQt8", // Random NFT metadata (1.7kb of JSON)
    "XOJ8FBxa6sGLwChnxhF2L71WkKLSKq1aU5Yn5WnFLrY", // GPT-2 117M model.
    "M-OzkyjxWhSvWYF87p0kvmkuAEEkvOzIj4nMNoSIydc", // GPT-2-XL 4-bit quantized model.
    "kd34P4974oqZf2Db-hFTUiCipsU6CzbR6t-iJoQhKIo", // Phi-2 
    "ISrbGzQot05rs_HKC08O_SmkipYQnqgB1yC3mjZZeEo", // Phi-3 Mini 4k Instruct
    "sKqjvBbhqKvgzZT4ojP1FNvt4r_30cqjuIIQIr-3088", // CodeQwen 1.5 7B Chat q3
    "Pr2YVrxd7VwNdg6ekC0NXWNKXxJbfTlHhhlrKbAd1dA", // Llama3 8B Instruct q4
    "jbx-H6aq7b3BbNCHlK50Jz9L-6pz9qmldrYXMwjqQVI"  // Llama3 8B Instruct q8
  ]


var instantiateWasm = function (imports, cb) {
  console.log(imports)
  // merge imports argument
  // const customImports = {
  //   env: {
  //     memory: new WebAssembly.Memory({ initial: 8589934592 / 65536, maximum: 17179869184 / 65536, index: 'i64' })
  //   }
  // }
  //imports.env = Object.assign({}, imports.env, customImports.env)

  WebAssembly.instantiate(wasm, imports).then(result =>

    cb(result.instance)
  )
  return {}
}

const instance = await Module({
  admissableList: AdmissableList,
  WeaveDrive: weaveDrive,
  ARWEAVE: 'https://arweave.net',
  mode: "test",
  blockHeight: 100,
  spawn: {
    "Scheduler": "TEST_SCHED_ADDR"
  },
  process: {
    id: "b9hSuFwtmI8CeBmtCWmYlsR4LrEsa05oWRQHtjGKkUQ",
    owner: "fAyKJ0ETeAKigNYaIDNGJbl9YwGrzViHeq1xl5DfMxQ",
    tags: [
      { name: "Extension", value: "Weave-Drive" }
    ]
  },
  instantiateWasm
})

await instance['FS_createPath']('/', 'data')
await instance['FS_createDataFile']('/', 'data/1', Buffer.from('HELLO WORLD'), true, false, false)



const handle = async function (msg, env) {
  const res = await instance.cwrap('handle', 'string', ['string', 'string'], { async: true })(JSON.stringify(msg), JSON.stringify(env))
  console.log('Memory used:', instance.HEAP8.length)
  return JSON.parse(res)
}




async function run2() {
  let result = await handle(getEval(`
    local Llama = require("llama")
    io.stderr:write([[Loading model...\n]])
    local result = Llama.load("/data/ISrbGzQot05rs_HKC08O_SmkipYQnqgB1yC3mjZZeEo")
  `), getEnv())
  
  while (true) {

    const prompt = await rl.question('Prompt: ');

    const result = await handle(getEval(`
      Llama.setPrompt("${prompt}")
      io.stderr:write([[Prompt set! Running...\n]])
      local str = Llama.run(30)

      local result = ""
      for i = 0, 10, 1 do
        local token = Llama.next()
        result = result .. token
        io.stderr:write([[Got token: ]] .. token .. [[\n\n]])
      end

      return str
    `), getEnv())
    console.log("START SECOND MESSAGE")
    console.log(result.response)
  }

}
async function run() {


  await handle(
    getLua('M-OzkyjxWhSvWYF87p0kvmkuAEEkvOzIj4nMNoSIydc',
      90,
      "Hello how are you"),
    getEnv()
  )

  await handle(
    getLua('M-OzkyjxWhSvWYF87p0kvmkuAEEkvOzIj4nMNoSIydc',
      90,
      "I am chill"),
    getEnv()
  )
}


run2()

function getLua(model, len, prompt) {
  if (!prompt) {
    prompt = "Tell me a story."
  }
  return getEval(`
  io.stderr:write([[Loaded! Setting prompt...\n]])
  Llama.setPrompt([[${prompt}]])
  local result = ""
  io.stderr:write([[Running...\n]])
  for i = 0, ${len.toString()}, 1 do
    local token = Llama.next()
    result = result .. token
    io.stderr:write([[Got token: ]] .. token .. [[\n\n]])
  end
  return result`);
}


function getEval(expr) {
  return {
    Id: '1',
    Owner: 'TOM',
    Module: 'FOO',
    From: 'foo',
    'Block-Height': '1000',
    Timestamp: Date.now(),
    Tags: [
      { name: 'Action', value: 'Eval' }
    ],
    Data: expr
  }
}

function getEnv() {
  return {
    Process: {
      Id: 'AOS',
      Owner: 'TOM',
      Tags: [
        { name: 'Name', value: 'Thomas' }
      ]
    }
  }
}