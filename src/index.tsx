import { Hono } from 'hono'
import { jsxRenderer } from 'hono/jsx-renderer'

const app = new Hono()

function renderToolPanel(n: string) {
  return (
    <section class="bg-white p-6 rounded-lg shadow-sm border">
      <h2 class="text-lg font-semibold mb-4">사용 가능한 도구</h2>
      <select
        id={`tool-select-${n}`}
        onchange={`onToolSelect(${n})`}
        class="w-full px-4 py-2 border rounded focus:ring-2 focus:ring-indigo-500 outline-none mb-4"
        disabled
      >
        <option>먼저 도구를 가져오세요...</option>
      </select>
      <div id={`tool-description-${n}`} class="text-sm text-slate-600 mb-4 h-12 overflow-y-auto italic">
        세부 정보를 보려면 도구를 선택하세요.
      </div>
      <h3 class="text-sm font-bold uppercase text-slate-400 mb-2">인수 (JSON)</h3>
      <textarea
        id={`tool-args-${n}`}
        rows={8}
        class="w-full px-4 py-2 border rounded font-mono text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
        placeholder="{}"
      ></textarea>
      <button
        id={`run-btn-${n}`}
        onclick={`callTool(${n})`}
        disabled
        class="mt-4 w-full bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-300 text-white px-6 py-2 rounded transition font-medium"
      >
        도구 실행
      </button>
    </section>
  )
}

function renderResultPanel(n: string) {
  return (
    <section class="bg-white p-6 rounded-lg shadow-sm border flex flex-col min-h-[500px]">
      <div class="flex justify-between items-center mb-4">
        <h2 class="text-lg font-semibold">결과</h2>
        <div class="flex gap-2">
          <button id={`view-toggle-${n}`} onclick={`toggleView(${n})`} class="text-xs font-bold px-2 py-1 rounded bg-slate-200 hover:bg-slate-300 text-slate-600">원본 보기</button>
          <span id={`status-badge-${n}`} class="px-2 py-1 rounded text-xs font-bold bg-slate-100 text-slate-500">준비 완료</span>
        </div>
      </div>
      <div id={`result-pretty-${n}`} class="flex-1 space-y-4 overflow-auto">
        <div class="text-slate-400 italic text-sm">출력이 여기에 표시됩니다...</div>
      </div>
      <pre
        id={`result-raw-${n}`}
        class="hidden flex-1 p-4 bg-slate-900 text-emerald-400 rounded overflow-auto font-mono text-sm"
      ></pre>
    </section>
  )
}

app.get('*', jsxRenderer(({ children }) => {
  return (
    <html>
      <head>
        <title>MCP Tester</title>
        <script src="https://cdn.tailwindcss.com"></script>
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
      </head>
      <body class="bg-slate-50 text-slate-900 font-sans min-h-screen">
        {children}
      </body>
    </html>
  )
}))

app.post('/api/proxy', async (c) => {
  const { url, method, params } = await c.req.json()
  
  const body = {
    jsonrpc: "2.0",
    id: Date.now(),
    method,
    params
  }

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(body)
    })
    
    if (!response.ok) {
      return c.json({ error: `Server error: ${response.status}` }, { status: response.status })
    }

    const result = await response.json()
    return c.json(result)
  } catch (error) {
    return c.json({ error: (error as Error).message }, { status: 500 })
  }
})

app.get('/', (c) => {
  const env = c.env as { MCP_SERVER_DEFAULT: string; MCP_SERVER_DEFAULT_2: string }
  const url1 = env.MCP_SERVER_DEFAULT || ''
  const url2 = env.MCP_SERVER_DEFAULT_2 || ''

  return c.render(
    <div class="max-w-5xl mx-auto p-4 md:p-8">
      <header class="mb-8 border-b pb-4">
        <h1 class="text-3xl font-bold text-indigo-600">MCP 테스터</h1>
        <p class="text-slate-500">HTTP를 통해 Model Context Protocol 서버 테스트</p>
      </header>

      {/* Server Tabs */}
      <div class="mb-6">
        <div class="flex gap-2 border-b">
          <button id="tab-1" onclick="switchTab(1)" class="px-5 py-2 text-sm font-semibold border-b-2 border-indigo-600 text-indigo-600 -mb-px">서버 1</button>
          <button id="tab-2" onclick="switchTab(2)" class="px-5 py-2 text-sm font-semibold border-b-2 border-transparent text-slate-500 hover:text-slate-700 -mb-px">서버 2</button>
        </div>
      </div>

      {/* Server 1 Panel */}
      <div id="panel-1" class="space-y-6">
        <section class="bg-white p-6 rounded-lg shadow-sm border">
          <h2 class="text-lg font-semibold mb-2">연결 설정 — 서버 1</h2>
          <div class="flex flex-col md:flex-row gap-4 items-center">
            <input id="mcp-url-1" type="hidden" value={url1} />
            <div class="flex-1 px-4 py-2 bg-slate-100 border rounded text-slate-600 font-mono text-sm truncate">
              {url1 || '(MCP_SERVER_DEFAULT 미설정)'}
            </div>
            <button
              onclick="listTools(1)"
              class="bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-2 rounded transition font-medium whitespace-nowrap"
            >
              도구 가져오기
            </button>
          </div>
        </section>
        <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
          {renderToolPanel('1')}
          {renderResultPanel('1')}
        </div>
      </div>

      {/* Server 2 Panel */}
      <div id="panel-2" class="hidden space-y-6">
        <section class="bg-white p-6 rounded-lg shadow-sm border">
          <h2 class="text-lg font-semibold mb-2">연결 설정 — 서버 2</h2>
          <div class="flex flex-col md:flex-row gap-4 items-center">
            <input id="mcp-url-2" type="hidden" value={url2} />
            <div class="flex-1 px-4 py-2 bg-slate-100 border rounded text-slate-600 font-mono text-sm truncate">
              {url2 || '(MCP_SERVER_DEFAULT_2 미설정)'}
            </div>
            <button
              onclick="listTools(2)"
              disabled={!url2}
              class="bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-300 disabled:cursor-not-allowed text-white px-6 py-2 rounded transition font-medium whitespace-nowrap"
            >
              도구 가져오기
            </button>
          </div>
        </section>
        <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
          {renderToolPanel('2')}
          {renderResultPanel('2')}
        </div>
      </div>

      <script dangerouslySetInnerHTML={{ __html: `
        const state = {
          1: { tools: [], currentView: 'pretty' },
          2: { tools: [], currentView: 'pretty' }
        };

        function switchTab(n) {
          [1, 2].forEach(i => {
            document.getElementById('panel-' + i).classList.toggle('hidden', i !== n);
            const tab = document.getElementById('tab-' + i);
            if (i === n) {
              tab.className = 'px-5 py-2 text-sm font-semibold border-b-2 border-indigo-600 text-indigo-600 -mb-px';
            } else {
              tab.className = 'px-5 py-2 text-sm font-semibold border-b-2 border-transparent text-slate-500 hover:text-slate-700 -mb-px';
            }
          });
        }

        function toggleView(n) {
          const s = state[n];
          s.currentView = s.currentView === 'pretty' ? 'raw' : 'pretty';
          const toggle = document.getElementById('view-toggle-' + n);
          const pretty = document.getElementById('result-pretty-' + n);
          const raw = document.getElementById('result-raw-' + n);
          toggle.innerText = s.currentView === 'pretty' ? '원본 보기' : '형식 보기';
          pretty.classList.toggle('hidden', s.currentView === 'raw');
          raw.classList.toggle('hidden', s.currentView === 'pretty');
        }

        function renderResult(n, data) {
          const resultRaw = document.getElementById('result-raw-' + n);
          const resultPretty = document.getElementById('result-pretty-' + n);
          const statusBadge = document.getElementById('status-badge-' + n);

          resultRaw.innerText = JSON.stringify(data, null, 2);
          resultPretty.innerHTML = '';

          if (data.error) {
            resultPretty.innerHTML = \`<div class="p-4 bg-red-50 border border-red-200 rounded text-red-700">
              <div class="font-bold mb-1">오류 (\${data.error.code || '알 수 없음'})</div>
              <div class="text-sm">\${data.error.message || JSON.stringify(data.error)}</div>
            </div>\`;
            return;
          }

          if (data.result && data.result.content) {
            data.result.content.forEach((item, i) => {
              const container = document.createElement('div');
              container.className = 'p-4 bg-slate-50 border border-slate-200 rounded';

              if (item.type === 'text') {
                const header = document.createElement('div');
                header.className = 'text-xs font-bold uppercase text-slate-400 mb-2 flex justify-between';
                header.innerHTML = \`<span>콘텐츠 #\${i+1} (텍스트)</span>\`;
                const content = document.createElement('div');
                content.className = 'whitespace-pre-wrap text-sm text-slate-800 leading-relaxed';
                content.innerText = item.text;
                container.appendChild(header);
                container.appendChild(content);
              } else {
                const pre = document.createElement('pre');
                pre.className = 'text-xs overflow-auto text-slate-600';
                pre.innerText = JSON.stringify(item, null, 2);
                container.appendChild(pre);
              }
              resultPretty.appendChild(container);
            });

            if (data.result.isError) {
              statusBadge.innerText = 'TOOL ERROR';
              statusBadge.className = 'px-2 py-1 rounded text-xs font-bold bg-red-100 text-red-600';
            }
          } else {
            const container = document.createElement('div');
            container.className = 'p-4 bg-slate-50 border border-slate-200 rounded';
            const pre = document.createElement('pre');
            pre.className = 'text-sm overflow-auto text-slate-800';
            pre.innerText = JSON.stringify(data.result || data, null, 2);
            container.appendChild(pre);
            resultPretty.appendChild(container);
          }
        }

        async function listTools(n) {
          const url = document.getElementById('mcp-url-' + n).value;
          const toolSelect = document.getElementById('tool-select-' + n);
          const statusBadge = document.getElementById('status-badge-' + n);

          statusBadge.innerText = '가져오는 중...';
          statusBadge.className = 'px-2 py-1 rounded text-xs font-bold bg-amber-100 text-amber-600';

          try {
            const res = await fetch('/api/proxy', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ url, method: 'tools/list', params: {} })
            });
            const data = await res.json();
            if (data.error) throw data;

            state[n].tools = data.result.tools || [];
            toolSelect.innerHTML = state[n].tools.length > 0
              ? '<option value="">도구 선택...</option>' + state[n].tools.map(t => \`<option value="\${t.name}">\${t.name}</option>\`).join('')
              : '<option>발견된 도구 없음</option>';
            toolSelect.disabled = false;
            statusBadge.innerText = '연결됨';
            statusBadge.className = 'px-2 py-1 rounded text-xs font-bold bg-emerald-100 text-emerald-600';
            renderResult(n, data);
          } catch (e) {
            statusBadge.innerText = '오류';
            statusBadge.className = 'px-2 py-1 rounded text-xs font-bold bg-red-100 text-red-600';
            renderResult(n, e);
          }
        }

        function onToolSelect(n) {
          const toolSelect = document.getElementById('tool-select-' + n);
          const toolDescription = document.getElementById('tool-description-' + n);
          const toolArgs = document.getElementById('tool-args-' + n);
          const runBtn = document.getElementById('run-btn-' + n);
          const selectedName = toolSelect.value;
          const tool = state[n].tools.find(t => t.name === selectedName);

          if (tool) {
            toolDescription.innerText = tool.description || '설명 없음.';
            if (tool.inputSchema && tool.inputSchema.properties) {
              const skeleton = {};
              Object.keys(tool.inputSchema.properties).forEach(key => {
                const prop = tool.inputSchema.properties[key];
                skeleton[key] = prop.default !== undefined ? prop.default : (prop.type === 'string' ? "" : null);
              });
              toolArgs.value = JSON.stringify(skeleton, null, 2);
            } else {
              toolArgs.value = '{}';
            }
            runBtn.disabled = false;
          } else {
            toolDescription.innerText = '세부 정보를 보려면 도구를 선택하세요.';
            toolArgs.value = '';
            runBtn.disabled = true;
          }
        }

        async function callTool(n) {
          const url = document.getElementById('mcp-url-' + n).value;
          const toolSelect = document.getElementById('tool-select-' + n);
          const toolArgs = document.getElementById('tool-args-' + n);
          const statusBadge = document.getElementById('status-badge-' + n);
          const resultPretty = document.getElementById('result-pretty-' + n);
          const name = toolSelect.value;
          let args = {};

          try {
            args = JSON.parse(toolArgs.value || '{}');
          } catch (e) {
            alert('인수의 잘못된 JSON');
            return;
          }

          statusBadge.innerText = '실행 중...';
          statusBadge.className = 'px-2 py-1 rounded text-xs font-bold bg-blue-100 text-blue-600';
          resultPretty.innerHTML = '<div class="animate-pulse text-slate-400">도구 실행 중...</div>';

          try {
            const res = await fetch('/api/proxy', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ url, method: 'tools/call', params: { name, arguments: args } })
            });
            const data = await res.json();
            renderResult(n, data);
            if (!data.error && !(data.result && data.result.isError)) {
              statusBadge.innerText = '성공';
              statusBadge.className = 'px-2 py-1 rounded text-xs font-bold bg-emerald-100 text-emerald-600';
            }
          } catch (e) {
            statusBadge.innerText = '실패';
            statusBadge.className = 'px-2 py-1 rounded text-xs font-bold bg-red-100 text-red-600';
            renderResult(n, e);
          }
        }
      ` }} />
    </div>
  )
})

export default app
