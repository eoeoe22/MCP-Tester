import { Hono } from 'hono'
import { jsxRenderer } from 'hono/jsx-renderer'

const app = new Hono()

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
  const defaultUrl = (c.env as { MCP_SERVER_DEFAULT: string }).MCP_SERVER_DEFAULT || 'https://wiki.vialinks.xyz/api/mcp'
  
  return c.render(
    <div class="max-w-4xl mx-auto p-4 md:p-8">
      <header class="mb-8 border-b pb-4">
        <h1 class="text-3xl font-bold text-indigo-600">MCP Tester</h1>
        <p class="text-slate-500">Test Model Context Protocol servers over HTTP</p>
      </header>

      <div class="space-y-6">
        {/* Server Config */}
        <section class="bg-white p-6 rounded-lg shadow-sm border">
          <h2 class="text-lg font-semibold mb-4">Connection Settings</h2>
          <div class="flex flex-col md:flex-row gap-4">
            <input 
              id="mcp-url" 
              type="text" 
              placeholder="MCP Server URL" 
              value={defaultUrl}
              class="flex-1 px-4 py-2 border rounded focus:ring-2 focus:ring-indigo-500 outline-none"
            />
            <button 
              onclick="listTools()"
              class="bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-2 rounded transition font-medium"
            >
              Fetch Tools
            </button>
          </div>
        </section>

        {/* Tool Interaction */}
        <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
          <section class="bg-white p-6 rounded-lg shadow-sm border">
            <h2 class="text-lg font-semibold mb-4">Available Tools</h2>
            <select 
              id="tool-select" 
              onchange="onToolSelect()"
              class="w-full px-4 py-2 border rounded focus:ring-2 focus:ring-indigo-500 outline-none mb-4"
              disabled
            >
              <option>Fetch tools first...</option>
            </select>
            
            <div id="tool-description" class="text-sm text-slate-600 mb-4 h-12 overflow-y-auto italic">
              Select a tool to see details.
            </div>

            <h3 class="text-sm font-bold uppercase text-slate-400 mb-2">Arguments (JSON)</h3>
            <textarea 
              id="tool-args" 
              rows={8}
              class="w-full px-4 py-2 border rounded font-mono text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
              placeholder="{}"
            ></textarea>
            
            <button 
              id="run-btn"
              onclick="callTool()"
              disabled
              class="mt-4 w-full bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-300 text-white px-6 py-2 rounded transition font-medium"
            >
              Execute Tool
            </button>
          </section>

          <section class="bg-white p-6 rounded-lg shadow-sm border flex flex-col min-h-[500px]">
            <div class="flex justify-between items-center mb-4">
              <h2 class="text-lg font-semibold">Result</h2>
              <div class="flex gap-2">
                <button id="view-toggle" onclick="toggleView()" class="text-xs font-bold px-2 py-1 rounded bg-slate-200 hover:bg-slate-300 text-slate-600">SHOW RAW</button>
                <span id="status-badge" class="px-2 py-1 rounded text-xs font-bold bg-slate-100 text-slate-500">READY</span>
              </div>
            </div>
            
            {/* Pretty View */}
            <div id="result-pretty" class="flex-1 space-y-4 overflow-auto">
              <div class="text-slate-400 italic text-sm">Output will appear here...</div>
            </div>

            {/* Raw View (Hidden) */}
            <pre 
              id="result-raw" 
              class="hidden flex-1 p-4 bg-slate-900 text-emerald-400 rounded overflow-auto font-mono text-sm"
            ></pre>
          </section>
        </div>
      </div>

      <script dangerouslySetInnerHTML={{ __html: `
        let tools = [];
        let currentView = 'pretty';
        const mcpUrlInput = document.getElementById('mcp-url');
        const toolSelect = document.getElementById('tool-select');
        const toolDescription = document.getElementById('tool-description');
        const toolArgs = document.getElementById('tool-args');
        const runBtn = document.getElementById('run-btn');
        const resultPretty = document.getElementById('result-pretty');
        const resultRaw = document.getElementById('result-raw');
        const statusBadge = document.getElementById('status-badge');
        const viewToggle = document.getElementById('view-toggle');

        function toggleView() {
          currentView = currentView === 'pretty' ? 'raw' : 'pretty';
          viewToggle.innerText = currentView === 'pretty' ? 'SHOW RAW' : 'SHOW PRETTY';
          resultPretty.classList.toggle('hidden', currentView === 'raw');
          resultRaw.classList.toggle('hidden', currentView === 'pretty');
        }

        function renderResult(data) {
          resultRaw.innerText = JSON.stringify(data, null, 2);
          resultPretty.innerHTML = '';

          if (data.error) {
            resultPretty.innerHTML = \`<div class="p-4 bg-red-50 border border-red-200 rounded text-red-700">
              <div class="font-bold mb-1">Error (\${data.error.code || 'Unknown'})</div>
              <div class="text-sm">\${data.error.message || JSON.stringify(data.error)}</div>
            </div>\`;
            return;
          }

          // Handle MCP Tool Call Result Structure
          if (data.result && data.result.content) {
            data.result.content.forEach((item, i) => {
              const container = document.createElement('div');
              container.className = 'p-4 bg-slate-50 border border-slate-200 rounded';
              
              if (item.type === 'text') {
                const header = document.createElement('div');
                header.className = 'text-xs font-bold uppercase text-slate-400 mb-2 flex justify-between';
                header.innerHTML = \`<span>Content #\${i+1} (Text)</span>\`;
                
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
            // Generic Result
            const container = document.createElement('div');
            container.className = 'p-4 bg-slate-50 border border-slate-200 rounded';
            const pre = document.createElement('pre');
            pre.className = 'text-sm overflow-auto text-slate-800';
            pre.innerText = JSON.stringify(data.result || data, null, 2);
            container.appendChild(pre);
            resultPretty.appendChild(container);
          }
        }

        async function listTools() {
          const url = mcpUrlInput.value;
          statusBadge.innerText = 'FETCHING...';
          statusBadge.className = 'px-2 py-1 rounded text-xs font-bold bg-amber-100 text-amber-600';
          
          try {
            const res = await fetch('/api/proxy', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ url, method: 'tools/list', params: {} })
            });
            const data = await res.json();
            
            if (data.error) throw data;
            
            tools = data.result.tools || [];
            
            toolSelect.innerHTML = tools.length > 0 
              ? '<option value="">Select a tool...</option>' + tools.map(t => \`<option value="\${t.name}">\${t.name}</option>\`).join('')
              : '<option>No tools found</option>';
            
            toolSelect.disabled = false;
            statusBadge.innerText = 'CONNECTED';
            statusBadge.className = 'px-2 py-1 rounded text-xs font-bold bg-emerald-100 text-emerald-600';
            renderResult(data);
          } catch (e) {
            statusBadge.innerText = 'ERROR';
            statusBadge.className = 'px-2 py-1 rounded text-xs font-bold bg-red-100 text-red-600';
            renderResult(e);
          }
        }

        function onToolSelect() {
          const selectedName = toolSelect.value;
          const tool = tools.find(t => t.name === selectedName);
          
          if (tool) {
            toolDescription.innerText = tool.description || 'No description.';
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
            toolDescription.innerText = 'Select a tool to see details.';
            toolArgs.value = '';
            runBtn.disabled = true;
          }
        }

        async function callTool() {
          const url = mcpUrlInput.value;
          const name = toolSelect.value;
          let args = {};
          
          try {
            args = JSON.parse(toolArgs.value || '{}');
          } catch (e) {
            alert('Invalid JSON in arguments');
            return;
          }

          statusBadge.innerText = 'EXECUTING...';
          statusBadge.className = 'px-2 py-1 rounded text-xs font-bold bg-blue-100 text-blue-600';
          resultPretty.innerHTML = '<div class="animate-pulse text-slate-400">Executing tool...</div>';

          try {
            const res = await fetch('/api/proxy', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ 
                url, 
                method: 'tools/call', 
                params: { name, arguments: args } 
              })
            });
            const data = await res.json();
            renderResult(data);
            if (!data.error && !(data.result && data.result.isError)) {
              statusBadge.innerText = 'SUCCESS';
              statusBadge.className = 'px-2 py-1 rounded text-xs font-bold bg-emerald-100 text-emerald-600';
            }
          } catch (e) {
            statusBadge.innerText = 'FAILED';
            statusBadge.className = 'px-2 py-1 rounded text-xs font-bold bg-red-100 text-red-600';
            renderResult(e);
          }
        }
      ` }} />
    </div>
  )
})

export default app
