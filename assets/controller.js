/*
 * --------------------------------------------------------------------------------------------------------------
 * main controller javascript used by index.html
 *
 * Note that initialize() MUST be executed at the end of index.html
 * --------------------------------------------------------------------------------------------------------------
 */
const UI = {
  flow_selector: '#flow-selector',
  flow_open: '#flow-open',
  process_file: '#process-file',
  progress_upload: '#progress-upload',
  file_name: '#file-name',
  file_size: '#file-size',
  download_response: '#download-reponse',
  progress_download: '#progress-download',
  process_flow_file: '#process-flow-file',
  progress_flow_upload: '#progress-flow-upload',
  flow_file_name: '#flow-file-name',
  flow_file_size: '#flow-file-size',
}


let phoneNumber;
const baseUrl = new URL(location.href);
baseUrl.pathname = baseUrl.pathname.replace(/\/index\.html$/, '');
delete baseUrl.hash;
delete baseUrl.search;
const fullUrl = baseUrl.href.substr(0, baseUrl.href.length - 1);

const timer = (ms) => new Promise((res) => setTimeout(res, ms));

/*
 * --------------------------------------------------------------------------------------------------------------
 * select specified flowName and check Flow deployment
 *
 * input:
 * - toSelectOptionValue: option value to force select, if null, looks for seleted option from UI element
 * --------------------------------------------------------------------------------------------------------------
 */
async function selectFlow(toSelectOptionValue) {
  const THIS = 'selectFlow:';

  try {
    if (toSelectOptionValue) {
      $(UI.flow_selector).val(toSelectOptionValue);
      console.log(THIS, 'selecting: ', toSelectOptionValue);
    }
    const flowFName = $(UI.flow_selector).text();
    const flowSid = $(UI.flow_selector).val();
    console.log(THIS, 'selected: ', flowFName, flowSid);

    // reset section
    $('.flow-loader').hide();

    const response = await fetch('assign-phone2flow', {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({flowSid: flowSid, token: accessToken}),
    });
    if (!response.ok) {
      throw Error(response.statusText);
    }
    console.log(THIS, await response.text());
    $(UI.flow_open).attr('href', `https://www.twilio.com/console/studio/flows/${flowSid}`);

    selectedFileName = $(UI.file_name).html();
    if (selectedFileName) $(UI.process_file).prop('disabled', false);

  } catch (err) {
    console.log(THIS, err);
  }
}

/*
 * --------------------------------------------------------------------------------------------------------------
 * fill flowSelector from available flow template assets
 *
 * returns: first option UI element value
 * --------------------------------------------------------------------------------------------------------------
 */
async function populateFlowSelector() {
  const THIS = 'populateFlowSelector:';

  try {
    const response = await fetch('/list-flows', {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({token:accessToken})
    });
    const flows = await response.json();
    console.log(THIS, `retrieved ${flows.length} flows`);
    $(UI.flow_selector).clear;
    let firstOptionValue = null;
    for (f of flows) {
      $(UI.flow_selector).append(`<option value="${f.flow_sid}">${f.friendlyName}</option>`);
      if (!firstOptionValue) {
        firstOptionValue = f.flow_sid;
      }
    }
    return firstOptionValue;

  } catch (err) {
    console.log(THIS, 'Error fetching flow!!!');
  }
}

/*
 * --------------------------------------------------------------------------------------------------------------
 * update selected file info
 * --------------------------------------------------------------------------------------------------------------
 */
let file = null;
function updateFileInfo() {
  const THIS = 'updateFileInfo:';

  const fileList = this.files;
  if (!this.files.length) return;

  console.log("selected file count: " + fileList.length);
  file = fileList[0];
  $(UI.file_name).html(file.name);
  $(UI.file_size).html("(" + file.size + " bytes)");

  $(UI.process_file).prop('disabled', false);
  $(UI.progress_upload).hide();
};


let flowFile = null;
function updateFlowFileInfo(eventTarget) {
  const THIS = 'updateFlowFileInfo:';

  const fileList = eventTarget.files;
  if (!eventTarget.files.length) return;

  console.log(THIS, "selected flow file count: " + fileList.length);
  flowFile = fileList[0];

  if (! flowFile.name.startsWith('Outreach')) {
    const message = `selected flow file (${flowFile.name}) does NOT start with "Outreach"!!!\nPlease reselect`;
    console.log(message);
    window.alert(message);
    return;
  }

  $(UI.flow_file_name).html(flowFile.name);
  $(UI.flow_file_size).html("(" + flowFile.size + " bytes)");

  $(UI.process_flow_file).prop('disabled', false);
  $(UI.progress_flow_upload).hide();
};

/*
 * --------------------------------------------------------------------------------------------------------------
 * convert csv data to json string
 * --------------------------------------------------------------------------------------------------------------
 */
function csv2json(csv){
  const THIS = 'csv2json:';
  console.log(THIS);

  const result = [];

  const lines = csv.split(/\r?\n/);
  // NOTE: If your columns contain commas in their values, you'll need
  // to deal with those before doing the next step
  // (you might convert them to &&& or something, then covert them back later)
  // jsfiddle showing the issue https://jsfiddle.net/
  const headers=lines[0].split(",");
  for (let i = 1; i < lines.length; i++) {
    if (lines[i].length === 0) continue; // skip empty row
    const obj = {};
    let currentline = lines[i].split(",");
    for(let j = 0; j < headers.length; j++) {
      obj[headers[j]] = currentline[j];
    }
    result.push(obj);
  }
  //return result; //JavaScript object
  return JSON.stringify(result); //JSON
}

/* --------------------------------------------------------------------------------------------------------------
 * requires variable 'file'
 * --------------------------------------------------------------------------------------------------------------
 */
async function processFile(e) {
  const THIS = 'processFile:';

  if (! file) throw Error('variable "file" not set!!!');
  try {
    console.log(THIS, 'file: ' + file.name);
    if (file.size == 0) return;

    $(UI.progress_upload).show();
    let n = 0;

    const flowSid = $(UI.flow_selector).val();

    const reader = new FileReader();
    reader.readAsText(file);
    reader.onload = function(event) {
      console.log(THIS, 'reader.onload');
      const csv = event.target.result;

      const data = csv.split(/\r?\n/);
      n = data.filter(r => r.length > 0).length - 1; // # of lines excluding empty line & header

      const jsonText = csv2json(csv);
      const jsonObj = JSON.parse(jsonText);
      let i = 0;
      for (let j of jsonObj) {
        // $(UI.progress_upload).attr({
        //   value: ++i,
        //   label: `uploaded ${i} of ${n}`
        // });

        j.outreach_id = file.name;
        fetch(`/execute-flow`, {
          method: 'POST',
          headers: {
            Accept: 'application/json',
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            flowSid: flowSid,
            patient: j,
            token: accessToken
          }),
        })
        .then((response) => {
          console.log(THIS, ++i, response);
          $(UI.progress_upload).text(`uploaded ${n} rows`);
        })
        .catch((err) => {
          console.log(err);
        });
      }
    };
    reader.onerror = function() {
      alert('Unable to read ' + file.name);
    }

    $(UI.process_file).prop('disabled', true);

  } catch (err) {
    console.log(THIS, err);
  }
};

/* --------------------------------------------------------------------------------------------------------------
 * requires variable 'flowFile'
 * --------------------------------------------------------------------------------------------------------------
 */
async function processFlowFile(e) {
  const THIS = 'processFlowFile:';

  if (! flowFile) throw Error('variable "flowFile" not set!!!');
  try {
    console.log(THIS, 'file: ' + flowFile);
    if (flowFile.size == 0) return;

    $(UI.progress_flow_upload).show();

    const reader = new FileReader();
    reader.readAsText(flowFile);
    reader.onload = async function(event) {
      console.log(THIS, 'reader.onload');
      const flowDefinition = event.target.result;

//      const data = csv.split(/\r?\n/);

      const response = await fetch(`/add-flow`, {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          flowName: flowFile.name.replace('.json', ''),
          flowDefinition: flowDefinition,
          token: accessToken
        }),
      });
      const flow = await response.json();

      $(UI.progress_flow_upload).text(`uploaded flow definition`);

      $(UI.process_flow_file).prop('disabled', true);

      await populateFlowSelector(null);
      selectFlow(flow.sid);
    };
    reader.onerror = function() {
      alert('Unable to read ' + flowFile.name);
    }

  } catch (err) {
    console.log(THIS, err);
  }
};

/*
 * --------------------------------------------------------------------------------------------------------------
 * download responses
 * --------------------------------------------------------------------------------------------------------------
 */
async function downloadResponses(e) {
  const THIS = 'downloadResponses:';

  try {
    $(UI.download_response).prop('disabled', true);
    $(UI.progress_download).show();

    const flowSid = $(UI.flow_selector).val();
    const orientation = 'ROW';
    let body = null;

    let response = await fetch(`/collect-responses-header`, {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        flowSid: flowSid,
        orientation: orientation,
        token: accessToken,
      }),
    });
    body = await response.text();

    response = await fetch(`/list-executions`, {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        flowSid: flowSid,
        token: accessToken,
      }),
    });
    const execution_sids = JSON.parse(await response.text());

    $(UI.progress_download).attr({
      max: execution_sids.length,
      value: 0,
      label: `downloaded 0 of ${execution_sids.length}`
    });

    let i = 0;
    for (esid of execution_sids) {
      response = await fetch(`/collect-responses-data`, {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          flowSid: flowSid,
          execution_sid: esid,
          orientation: orientation,
          token: accessToken,
        }),
      });
      const row = await response.text();
      $(UI.progress_download).attr({
        value: ++i,
        label: `downloaded ${i} of ${execution_sids.length}`
      });
      body += row;
    }

    const downloadLink = document.createElement('a');
    downloadLink.href = "data:application-octet-stream,"+encodeURIComponent(body);
    downloadLink.download = 'outreach-responses.csv';
    downloadLink.click();
    downloadLink.remove();

  } catch (err) {
    console.log(THIS, err);
  } finally {
    $(UI.progress_download).hide();
    $(UI.download_response).prop('disabled', false);
  }
}


/*
 * --------------------------------------------------------------------------------------------------------------
 * initialize client javascript objects/triggers
 * --------------------------------------------------------------------------------------------------------------
 */
async function initialize() {
  const THIS = 'initialize:';

  const firstOptionValue = await populateFlowSelector();
  await selectFlow(firstOptionValue);

  const inputElement = document.getElementById('patient-file');
  const fileSelect = document.getElementById('select-file');
  fileSelect.addEventListener("click", function(e) {
    if (inputElement) {
        inputElement.click();
    }
    e.preventDefault(); // prevent navigation to "#"
  }, false);
  inputElement.addEventListener("change", updateFileInfo, false);
  // eventListener must be placed AFTER addEventListener
  document.getElementById("process-file").addEventListener("click", processFile);

//  const downloadButton = document.getElementById('download-responses');
//  downloadButton.addEventListener("click", downloadResponses);
}