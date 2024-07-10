// Import the express module
import express from "express"
import bodyParser from "body-parser";
import { readFileSync } from 'fs';
import Module from "./AOS.js";
import weaveDrive from "./weavedrive.js";

const wasm = readFileSync('./AOS.wasm')

// Create an instance of an Express application
const app = express();

const port = 3001;

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));


const AdmissableList =
{
  "gpt2": "XOJ8FBxa6sGLwChnxhF2L71WkKLSKq1aU5Yn5WnFLrY", // GPT-2 117M model.
  "gpt2-xl": "M-OzkyjxWhSvWYF87p0kvmkuAEEkvOzIj4nMNoSIydc", // GPT-2-XL 4-bit quantized model.
  "phi2": "kd34P4974oqZf2Db-hFTUiCipsU6CzbR6t-iJoQhKIo", // Phi-2 
  "phi3-mini": "ISrbGzQot05rs_HKC08O_SmkipYQnqgB1yC3mjZZeEo", // Phi-3 Mini 4k Instruct
  "Code-Qwen": "sKqjvBbhqKvgzZT4ojP1FNvt4r_30cqjuIIQIr-3088", // CodeQwen 1.5 7B Chat q3
  "Llama3-q4": "Pr2YVrxd7VwNdg6ekC0NXWNKXxJbfTlHhhlrKbAd1dA", // Llama3 8B Instruct q4
  "Llama3-q8": "jbx-H6aq7b3BbNCHlK50Jz9L-6pz9qmldrYXMwjqQVI"  // Llama3 8B Instruct q8
}


var instantiateWasm = function (imports, cb) {

  // merge imports argument
  // const customImports = {
  //   env: {
  //     memory: new WebAssembly.Memory({ initial: 8589934592 / 65536, maximum: 17179869184 / 65536, index: 'i64' })
  //   }
  // }
  // imports.env = Object.assign({}, imports.env, customImports.env)

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

app.get('/', (req, res) => {
  res.send('Hello, world!');
});


app.get('/api/get-models', (req, res) => {
  res.json(AdmissableList);
});

app.post('/api/load-model', async (req, res) => {

  const model = req.body.model
  // initialize gpt
  await handle(getEval(`
    local Llama = require("llama")
    io.stderr:write([[Loading model...\n]])
    local result = Llama.load("/data/${AdmissableList[model]}")
  `), getEnv())
  res.json("Model Loaded");
  
});

app.post('/api/generate-prompt', async (req, res) => {
  const prompt = req.body.prompt;
  const tokens = req.body.tokens
  console.log('Received new data:', prompt);


  const result = await handle(getEval(`
    Llama.setPrompt("${prompt}")
    io.stderr:write([[Prompt set! Running...\n]])

    local result = ""
    for i = 0, ${tokens}, 1 do
      local token = Llama.next()
      result = result .. token
      io.stderr:write([[Got token: ]] .. token .. [[\n\n]])
    end

    return result
  `), getEnv())

  let llm_res = result.response.Output.data.output
  res.status(201).json({
    message: 'Result',
    data: llm_res
  });
});

app.listen(port, () => {
  console.log(`Server is running on http://localhost:${port}`);
});



function getLua(model, len, prompt) {
  if (!prompt) {
    prompt = "Tell me a story."
  }
  return getEval(`
  local Llama = require("llama")
  io.stderr:write([[Loaded! Setting prompt...\n]])
  io.stderr:write([[Loading model...\n]])
  Llama.load('/data/${model}')
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