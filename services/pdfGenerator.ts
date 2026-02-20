
import { PermitRecord } from '../types';
import { formatLongDate, formatSimpleDate, toProperCase } from '../utils/formatters';
import { CONFIG } from '../config';

export const generateDecretoPDF = async (record: PermitRecord, forcePdf: boolean = true) => {
  const pdfWindow = window.open('about:blank', '_blank');

  const typeCode = record.solicitudType;
  const nombreMayuscula = record.funcionario.toUpperCase().trim();
  const nombreProperCase = toProperCase(record.funcionario);
  const actoOficial = record.acto.trim();

  // Nombre exacto solicitado: SGDP-PA N° 013/2026 - NOMBRE
  const finalFileName = `SGDP-${typeCode} N° ${actoOficial} - ${nombreMayuscula}`;

  if (pdfWindow) {
    pdfWindow.document.write(`
      <html>
        <head>
          <title>GDP Cloud - Procesando</title>
          <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700;800;900&display=swap" rel="stylesheet">
          <style>
            body { 
              font-family: 'Inter', sans-serif; 
              background: #0f172a; 
              color: white; 
              display: flex; 
              align-items: center; 
              justify-content: center; 
              height: 100vh; 
              margin: 0; 
              overflow: hidden;
            }
            .card {
              background: #1e293b;
              padding: 3rem;
              border-radius: 2rem;
              text-align: center;
              box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.5);
              border: 1px solid #334155;
              max-width: 500px;
              width: 90%;
            }
            .loader { 
              border: 4px solid #1e293b; 
              border-top: 4px solid #38bdf8; 
              border-radius: 50%; 
              width: 60px; 
              height: 60px; 
              animation: spin 1s cubic-bezier(0.5, 0, 0.5, 1) infinite; 
              margin: 0 auto 2rem; 
            }
            @keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
            h2 { font-size: 1.25rem; text-transform: uppercase; letter-spacing: 0.2em; color: white; margin: 0; font-weight: 800; }
            .filename { font-size: 0.8rem; color: #38bdf8; margin-top: 1.5rem; background: #0f172a; padding: 1rem; border-radius: 1rem; border: 1px solid #38bdf830; font-family: monospace; word-break: break-all; }
            p { font-size: 0.875rem; color: #94a3b8; margin-top: 1rem; line-height: 1.6; }
            .badge { display: inline-block; margin-top: 1.5rem; padding: 0.5rem 1rem; background: #38bdf820; border-radius: 0.75rem; font-size: 10px; font-weight: 700; color: #38bdf8; border: 1px solid #38bdf840; letter-spacing: 0.1em; }
          </style>
        </head>
        <body>
          <div class="card">
            <div class="loader"></div>
            <h2>GDP ENGINE v${CONFIG.APP_VERSION}</h2>
            <p>Generando documento en Drive...</p>
            <div class="filename">${finalFileName}</div>
            <div class="badge">CONEXIÓN SEGURA</div>
          </div>
        </body>
      </html>
    `);
  }

  // Las llaves con guiones bajos serán buscadas con espacios por el script GAS
  // Ej: Cantidad_de_días -> «Cantidad de días»
  const basePayload = {
    "fileName": finalFileName,
    "Decreto": actoOficial,
    "FUNCIONARIO": nombreMayuscula,
    "Funcionario": nombreProperCase,
    "solicitudType": typeCode,
    "RUT": record.rut.trim(),
    "Fecha": formatSimpleDate(record.fechaDecreto),
    "Cantidad_de_días": record.cantidadDias.toString().replace('.', ','),
    "Fecha_de_inicio": formatLongDate(record.fechaInicio),
    "RA": record.ra,
    "Emite": record.emite
  };

  // Determinar si FL usa 1 o 2 períodos
  const hasTwoPeriods = typeCode === 'FL' && record.periodo2 && (record.solicitadoP2 || 0) > 0;

  // Campos específicos según tipo
  const payload = typeCode === 'FL' ? {
    ...basePayload,
    "templateId": hasTwoPeriods ? CONFIG.TEMPLATE_FL_2P_DOC_ID : CONFIG.TEMPLATE_FL_1P_DOC_ID,
    "Fecha_de_Término": formatLongDate(record.fechaTermino || ''),
    "Período_1": record.periodo1 || '',
    "Saldo_Disponible_Periodo_1": (record.saldoDisponibleP1 || 0).toString().replace('.', ','),
    "Solicitados_Periodo_1": (record.solicitadoP1 || 0).toString().replace('.', ','),
    "Saldo_Final_Periodo_1": ((record.saldoDisponibleP1 || 0) - (record.solicitadoP1 || 0)).toString().replace('.', ','),
    ...(hasTwoPeriods ? {
      "Período_2": record.periodo2 || '',
      "Saldo_Disponible_Periodo_2": (record.saldoDisponibleP2 || 0).toString().replace('.', ','),
      "Solicitados_Periodo_2": (record.solicitadoP2 || 0).toString().replace('.', ','),
      "Saldo_Final_Periodo_2": ((record.saldoDisponibleP2 || 0) - (record.solicitadoP2 || 0)).toString().replace('.', ','),
    } : {}),
  } : {
    ...basePayload,
    "Tipo_de_Jornada": record.tipoJornada.replace(/[()]/g, '').trim(),
    "Días_a_su_haber": record.diasHaber.toFixed(1).replace('.', ','),
    "Saldo_final": (record.diasHaber - record.cantidadDias).toFixed(1).replace('.', ','),
  };

  try {
    // Usar el endpoint correcto según tipo de solicitud y períodos
    const scriptUrl = typeCode === 'FL'
      ? (hasTwoPeriods ? CONFIG.WEB_APP_URL_FL_2P : CONFIG.WEB_APP_URL_FL)
      : CONFIG.WEB_APP_URL;
    const response = await fetch(scriptUrl, {
      method: 'POST',
      mode: 'cors',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify(payload)
    });

    if (!response.ok) throw new Error(`HTTP Error: ${response.status}`);

    const result = await response.json();

    if (result.success && result.url && pdfWindow) {
      const docUrl = result.url;
      const pdfBase64 = result.pdfBase64;
      const safeName = finalFileName.replace(/\//g, '_');

      if (pdfBase64) {
        // Descargar PDF directamente desde base64 devuelto por GAS
        const byteCharacters = atob(pdfBase64);
        const byteNumbers = new Array(byteCharacters.length);
        for (let i = 0; i < byteCharacters.length; i++) {
          byteNumbers[i] = byteCharacters.charCodeAt(i);
        }
        const byteArray = new Uint8Array(byteNumbers);
        const blob = new Blob([byteArray], { type: 'application/pdf' });
        const blobUrl = URL.createObjectURL(blob);

        // Trigger descarga automática
        const a = pdfWindow.document.createElement('a');
        a.href = blobUrl;
        a.download = `${safeName}.pdf`;
        pdfWindow.document.body.appendChild(a);
        a.click();
        URL.revokeObjectURL(blobUrl);
      }

      // Mostrar opciones de descarga
      const pdfDownloadFn = pdfBase64 ? `
        <script>
          function downloadPdf() {
            var b64 = "${pdfBase64}";
            var byteChars = atob(b64);
            var byteNums = new Array(byteChars.length);
            for (var i = 0; i < byteChars.length; i++) byteNums[i] = byteChars.charCodeAt(i);
            var blob = new Blob([new Uint8Array(byteNums)], {type: 'application/pdf'});
            var url = URL.createObjectURL(blob);
            var a = document.createElement('a');
            a.href = url;
            a.download = "${safeName}.pdf";
            document.body.appendChild(a);
            a.click();
            URL.revokeObjectURL(url);
          }
        </script>
      ` : '';

      pdfWindow.document.body.innerHTML = `
        ${pdfDownloadFn}
        <div style="text-align:center; padding: 50px; font-family: 'Inter', sans-serif; background: #0f172a; min-height: 100vh; display: flex; align-items: center; justify-content: center; margin: 0;">
          <div style="background: #1e293b; padding: 3rem; border-radius: 2rem; border: 1px solid #10b98155; max-width: 500px; width: 90%;">
            <div style="width: 60px; height: 60px; background: #10b98130; border-radius: 50%; display: flex; align-items: center; justify-content: center; margin: 0 auto 1.5rem;">
              <svg width="32" height="32" fill="none" stroke="#10b981" stroke-width="2" viewBox="0 0 24 24"><path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
            </div>
            <h3 style="color: white; margin-bottom: 10px; font-size: 1.25rem; font-weight: 800; text-transform: uppercase; letter-spacing: 0.1em;">¡Documento Generado!</h3>
            <p style="color: #94a3b8; font-size: 12px; margin-bottom: 1.5rem;">${safeName}.pdf</p>
            
            <div style="display: flex; flex-direction: column; gap: 12px;">
              <a href="${docUrl}" target="_blank" style="display: flex; align-items: center; justify-content: center; gap: 8px; padding: 1rem 1.5rem; background: #3b82f6; color: white; text-decoration: none; border-radius: 0.875rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; font-size: 11px;">
                <svg width="16" height="16" fill="currentColor" viewBox="0 0 24 24"><path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-5 14H7v-2h7v2zm3-4H7v-2h10v2zm0-4H7V7h10v2z"/></svg>
                Abrir en Google Docs
              </a>
              ${pdfBase64 ? `
              <button onclick="downloadPdf()" style="display: flex; align-items: center; justify-content: center; gap: 8px; padding: 1rem 1.5rem; background: #ef4444; color: white; border: none; border-radius: 0.875rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; font-size: 11px; cursor: pointer;">
                <svg width="16" height="16" fill="currentColor" viewBox="0 0 24 24"><path d="M14 2H6c-1.1 0-2 .9-2 2v16c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V8l-6-6zm-1 7V3.5L18.5 9H13z"/></svg>
                Descargar PDF
              </button>` : `
              <a href="${docUrl.replace(/\/edit.*$/, '/export?format=pdf')}" style="display: flex; align-items: center; justify-content: center; gap: 8px; padding: 1rem 1.5rem; background: #ef4444; color: white; text-decoration: none; border-radius: 0.875rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; font-size: 11px;">
                <svg width="16" height="16" fill="currentColor" viewBox="0 0 24 24"><path d="M14 2H6c-1.1 0-2 .9-2 2v16c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V8l-6-6zm-1 7V3.5L18.5 9H13z"/></svg>
                Descargar PDF
              </a>`}
            </div>
            
            <p style="color: #64748b; font-size: 10px; margin-top: 1.5rem; text-transform: uppercase; letter-spacing: 0.1em;">El documento también fue guardado en tu Drive</p>
            <button onclick="window.close()" style="margin-top: 1rem; padding: 0.75rem 1.25rem; background: #334155; color: #94a3b8; border:none; border-radius: 0.75rem; cursor:pointer; font-weight: 600; font-size: 10px;">Cerrar ventana</button>
          </div>
        </div>
      `;
    } else {
      throw new Error(result.error || "Respuesta inválida del servidor.");
    }
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Error desconocido';
    if (pdfWindow) {
      pdfWindow.document.body.innerHTML = `
        <div style="text-align:center; padding: 50px; color: #ef4444; font-family: 'Inter', sans-serif; background: #0f172a; height: 100vh; display: flex; align-items: center; justify-content: center; margin: 0;">
          <div style="background: #1e293b; padding: 3rem; border-radius: 2rem; border: 1px solid #ef444455; max-width: 500px; width: 90%;">
            <h3 style="color: white; margin-bottom: 20px; font-size: 1.25rem; font-weight: 800; text-transform: uppercase; letter-spacing: 0.1em;">Fallo en Servidor</h3>
            <p style="color: #ef4444; font-family: monospace; font-size: 12px; background: #450a0a; padding: 1rem; border-radius: 1rem;">${errorMessage}</p>
            <p style="color: #94a3b8; font-size: 11px; margin-top: 15px;">Asegúrate de haber actualizado el código en Google Apps Script.</p>
            <button onclick="window.close()" style="margin-top: 1.5rem; padding: 0.875rem 1.5rem; background: #ef4444; color: white; border:none; border-radius: 0.875rem; cursor:pointer; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; font-size: 11px;">Cerrar</button>
          </div>
        </div>
      `;
    }
  }
};
