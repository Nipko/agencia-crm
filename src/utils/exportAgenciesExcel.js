import ExcelJS from "exceljs";

const TYPE_LABELS = {
  AGENCY: "Agencia Minorista",
  GOVERNMENT: "Convenio Estatal",
  CORPORATE: "Corporativo"
};

const STATUS_LABELS = {
  ACTIVE: "ACTIVO",
  WARNING: "ADVERTENCIA",
  BLOCKED: "BLOQUEADO",
  INACTIVE: "INACTIVO"
};

const formatDate = (dateValue) => {
  if (!dateValue) return "";
  const d = new Date(dateValue);
  if (isNaN(d.getTime())) return String(dateValue);
  return d.toISOString().slice(0, 10);
};

const BORDER_THIN = {
  top: { style: "thin", color: { argb: "FFE2E8F0" } },
  left: { style: "thin", color: { argb: "FFE2E8F0" } },
  bottom: { style: "thin", color: { argb: "FFE2E8F0" } },
  right: { style: "thin", color: { argb: "FFE2E8F0" } }
};

const HEADER_BORDER = {
  top: { style: "thin", color: { argb: "FF334155" } },
  left: { style: "thin", color: { argb: "FF334155" } },
  bottom: { style: "medium", color: { argb: "FF4F46E5" } },
  right: { style: "thin", color: { argb: "FF334155" } }
};

/**
 * Exporta el directorio completo de agencias y clientes a un archivo Excel (.xlsx)
 * con encabezados corporativos, estilos profesionales, fórmulas y hoja de resumen ejecutivo.
 */
export async function exportAgenciesToExcel({ clients = [], signatures = [], contracts = [] }) {
  if (!clients.length) {
    throw new Error("No hay información de agencias disponible para exportar.");
  }

  const wb = new ExcelJS.Workbook();
  wb.creator = "Planetour CRM";
  wb.lastModifiedBy = "Planetour CRM";
  wb.created = new Date();
  wb.modified = new Date();

  // -------------------------------------------------------------
  // HOJA 1: Directorio Maestro de Agencias
  // -------------------------------------------------------------
  const ws = wb.addWorksheet("Directorio de Agencias", {
    views: [{ state: "frozen", xSplit: 3, ySplit: 4 }]
  });

  const columnsDef = [
    { key: "index", label: "No.", width: 6, align: "center" },
    { key: "id", label: "ID Cliente", width: 14, align: "center" },
    { key: "name", label: "Razón Social / Nombre Comercial", width: 38, align: "left" },
    { key: "typeLabel", label: "Tipo de Cliente", width: 22, align: "center" },
    { key: "nit", label: "NIT / RUT", width: 18, align: "center" },
    { key: "iataCode", label: "Código IATA / Pseudo", width: 22, align: "center" },
    { key: "tier", label: "Categoría (Tier)", width: 16, align: "center" },
    { key: "statusLabel", label: "Estado Operativo", width: 18, align: "center" },
    { key: "city", label: "Ciudad", width: 20, align: "center" },
    { key: "address", label: "Dirección", width: 32, align: "left" },
    { key: "phone", label: "Teléfono Principal", width: 20, align: "center" },
    { key: "creditLimit", label: "Límite de Crédito (COP)", width: 24, align: "right", numFmt: '"$"#,##0' },
    { key: "karingBalance", label: "Saldo Cartera Karing (COP)", width: 24, align: "right", numFmt: '"$"#,##0' },
    { key: "availableCredit", label: "Cupo Disponible (COP)", width: 24, align: "right", numFmt: '"$"#,##0' },
    { key: "overdueDays", label: "Días de Mora", width: 14, align: "center", numFmt: '#,##0' },
    { key: "debtStatus", label: "Estado Cartera", width: 20, align: "center" },
    { key: "ownerName", label: "Rep. Legal - Nombre", width: 26, align: "left" },
    { key: "ownerPhone", label: "Rep. Legal - Teléfono", width: 20, align: "center" },
    { key: "ownerEmail", label: "Rep. Legal - Correo", width: 28, align: "left" },
    { key: "payableName", label: "Cartera/Pagos - Contacto", width: 26, align: "left" },
    { key: "payablePhone", label: "Cartera/Pagos - Teléfono", width: 20, align: "center" },
    { key: "payableEmail", label: "Cartera/Pagos - Correo", width: 28, align: "left" },
    { key: "counterName", label: "Counter/Emisiones - Contacto", width: 26, align: "left" },
    { key: "counterPhone", label: "Counter/Emisiones - Teléfono", width: 20, align: "center" },
    { key: "counterEmail", label: "Counter/Emisiones - Correo", width: 28, align: "left" },
    { key: "activeSignaturesCount", label: "Firmas GDS Activas", width: 18, align: "center", numFmt: '#,##0' },
    { key: "pccs", label: "PCCs Asignados", width: 24, align: "center" },
    { key: "contractsCount", label: "Convenios / Contratos", width: 20, align: "center", numFmt: '#,##0' },
    { key: "createdAt", label: "Fecha Registro", width: 16, align: "center" }
  ];

  // Aplicar anchos de columnas
  ws.columns = columnsDef.map((col) => ({
    key: col.key,
    width: col.width
  }));

  // Fila 1: Título Principal
  ws.mergeCells(1, 1, 1, columnsDef.length);
  const titleCell = ws.getCell(1, 1);
  titleCell.value = "PLANETOUR CRM - DIRECTORIO Y MAESTRO DE AGENCIAS Y CLIENTES";
  titleCell.font = { name: "Segoe UI", size: 14, bold: true, color: { argb: "FFFFFFFF" } };
  titleCell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF132238" } };
  titleCell.alignment = { vertical: "middle", horizontal: "center" };
  ws.getRow(1).height = 36;

  // Fila 2: Subtítulo y Metadatos
  const now = new Date();
  const fechaGeneracion = now.toLocaleDateString("es-CO", {
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  });

  ws.mergeCells(2, 1, 2, columnsDef.length);
  const subCell = ws.getCell(2, 1);
  subCell.value = `Reporte generado el ${fechaGeneracion} | Total de agencias registradas: ${clients.length} | Moneda: Pesos Colombianos (COP)`;
  subCell.font = { name: "Segoe UI", size: 9.5, italic: true, color: { argb: "FFE0F2FE" } };
  subCell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1E3A5F" } };
  subCell.alignment = { vertical: "middle", horizontal: "center" };
  ws.getRow(2).height = 22;

  // Fila 3: Separador
  ws.getRow(3).height = 6;

  // Fila 4: Encabezados de Columnas
  const headerRow = ws.getRow(4);
  headerRow.height = 28;
  columnsDef.forEach((col, idx) => {
    const cell = headerRow.getCell(idx + 1);
    cell.value = col.label;
    cell.font = { name: "Segoe UI", size: 10, bold: true, color: { argb: "FFFFFFFF" } };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF0F172A" } };
    cell.alignment = { vertical: "middle", horizontal: "center", wrapText: true };
    cell.border = HEADER_BORDER;
  });

  // Habilitar Autofiltro en la fila de encabezados
  ws.autoFilter = {
    from: { row: 4, column: 1 },
    to: { row: 4, column: columnsDef.length }
  };

  // Cargar datos fila por fila
  const startDataRow = 5;
  clients.forEach((client, index) => {
    const rowNumber = startDataRow + index;
    const clientSignatures = signatures.filter((s) => s.clientId === client.id);
    const activeSignatures = clientSignatures.filter((s) => s.status === "ACTIVE");
    const pccsList = [...new Set(clientSignatures.map((s) => s.pcc).filter(Boolean))].join(", ") || "Sin PCC";
    const clientContracts = contracts.filter((c) => c.clientId === client.id);

    const creditLimit = Number(client.creditLimit || client.credit_limit || 0);
    const karingBalance = Number(client.karingBalance || client.karing_balance || 0);
    const overdueDays = Number(client.overdueDays || client.overdue_days || 0);

    let debtStatus = "Al día";
    if (overdueDays > 30) {
      debtStatus = `Mora crítica (${overdueDays}d)`;
    } else if (overdueDays > 0) {
      debtStatus = `En mora (${overdueDays}d)`;
    }

    const rowData = [
      index + 1,
      client.id || "",
      client.name || "",
      TYPE_LABELS[client.type] || client.type || "Agencia",
      client.nit || "",
      client.iataCode || client.iata_code || "N/A",
      client.tier || "GOLD",
      STATUS_LABELS[client.status] || client.status || "ACTIVO",
      client.city || "",
      client.address || "",
      client.phone || "",
      creditLimit,
      karingBalance,
      { formula: `L${rowNumber}-M${rowNumber}` },
      overdueDays,
      debtStatus,
      client.owner?.name || "",
      client.owner?.phone || "",
      client.owner?.email || "",
      client.accountsPayable?.name || "",
      client.accountsPayable?.phone || "",
      client.accountsPayable?.email || "",
      client.operationalCounter?.name || "",
      client.operationalCounter?.phone || "",
      client.operationalCounter?.email || "",
      activeSignatures.length,
      pccsList,
      clientContracts.length,
      formatDate(client.createdAt || client.created_at)
    ];

    const row = ws.addRow(rowData);
    row.height = 22;

    const isEven = index % 2 === 0;
    const baseFill = isEven ? "FFFFFFFF" : "FFF8FAFC";

    row.eachCell({ includeEmpty: true }, (cell, colNumber) => {
      const colDef = columnsDef[colNumber - 1];
      cell.font = { name: "Segoe UI", size: 9.5 };
      cell.border = BORDER_THIN;
      cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: baseFill } };

      if (colDef) {
        cell.alignment = {
          vertical: "middle",
          horizontal: colDef.align || "left"
        };
        if (colDef.numFmt) {
          cell.numFmt = colDef.numFmt;
        }
      }

      // Estilos visuales de etiquetas (Pills / Badges)
      // Estado Operativo (Col 8)
      if (colNumber === 8) {
        cell.font = { name: "Segoe UI", size: 9.5, bold: true };
        if (cell.value === "ACTIVO") {
          cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFDCFCE7" } };
          cell.font.color = { argb: "FF15803D" };
        } else if (cell.value === "ADVERTENCIA") {
          cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFFEF3C7" } };
          cell.font.color = { argb: "FFB45309" };
        } else if (cell.value === "BLOQUEADO") {
          cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFFEE2E2" } };
          cell.font.color = { argb: "FFB91C1C" };
        } else if (cell.value === "INACTIVO") {
          cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF1F5F9" } };
          cell.font.color = { argb: "FF64748B" };
        }
      }

      // Categoría / Tier (Col 7)
      if (colNumber === 7) {
        cell.font = { name: "Segoe UI", size: 9.5, bold: true };
        if (cell.value === "GOLD") {
          cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFFEF9C3" } };
          cell.font.color = { argb: "FF854D0E" };
        } else if (cell.value === "SILVER") {
          cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF1F5F9" } };
          cell.font.color = { argb: "FF475569" };
        } else if (cell.value === "BRONZE") {
          cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFFFEDD5" } };
          cell.font.color = { argb: "FF9A3412" };
        } else if (cell.value === "ESTATAL") {
          cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFE0E7FF" } };
          cell.font.color = { argb: "FF3730A3" };
        }
      }

      // Estado de Cartera (Col 16)
      if (colNumber === 16) {
        if (String(cell.value).includes("Mora crítica")) {
          cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFFEE2E2" } };
          cell.font = { name: "Segoe UI", size: 9.5, bold: true, color: { argb: "FF991B1B" } };
        } else if (String(cell.value).includes("En mora")) {
          cell.font = { name: "Segoe UI", size: 9.5, bold: true, color: { argb: "FFD97706" } };
        } else {
          cell.font = { name: "Segoe UI", size: 9.5, color: { argb: "FF15803D" } };
        }
      }
    });
  });

  // Fila de Totales al final
  const endDataRow = startDataRow + clients.length - 1;
  const totalsRowNumber = endDataRow + 1;

  ws.mergeCells(totalsRowNumber, 1, totalsRowNumber, 11);
  const totalLabelCell = ws.getCell(totalsRowNumber, 1);
  totalLabelCell.value = `TOTALES GENERALES (${clients.length} AGENCIAS)`;
  totalLabelCell.font = { name: "Segoe UI", size: 10, bold: true, color: { argb: "FF0F172A" } };
  totalLabelCell.alignment = { vertical: "middle", horizontal: "center" };

  const totalsRow = ws.getRow(totalsRowNumber);
  totalsRow.height = 26;

  // Fórmulas de totales
  const totalLimitCell = ws.getCell(totalsRowNumber, 12);
  totalLimitCell.value = { formula: `SUM(L${startDataRow}:L${endDataRow})` };
  totalLimitCell.numFmt = '"$"#,##0';
  totalLimitCell.alignment = { vertical: "middle", horizontal: "right" };

  const totalBalanceCell = ws.getCell(totalsRowNumber, 13);
  totalBalanceCell.value = { formula: `SUM(M${startDataRow}:M${endDataRow})` };
  totalBalanceCell.numFmt = '"$"#,##0';
  totalBalanceCell.alignment = { vertical: "middle", horizontal: "right" };

  const totalAvailableCell = ws.getCell(totalsRowNumber, 14);
  totalAvailableCell.value = { formula: `SUM(N${startDataRow}:N${endDataRow})` };
  totalAvailableCell.numFmt = '"$"#,##0';
  totalAvailableCell.alignment = { vertical: "middle", horizontal: "right" };

  const totalSigsCell = ws.getCell(totalsRowNumber, 26);
  totalSigsCell.value = { formula: `SUM(Z${startDataRow}:Z${endDataRow})` };
  totalSigsCell.numFmt = '#,##0';
  totalSigsCell.alignment = { vertical: "middle", horizontal: "center" };

  const totalContractsCell = ws.getCell(totalsRowNumber, 28);
  totalContractsCell.value = { formula: `SUM(AB${startDataRow}:AB${endDataRow})` };
  totalContractsCell.numFmt = '#,##0';
  totalContractsCell.alignment = { vertical: "middle", horizontal: "center" };

  // Estilo fila de totales
  for (let c = 1; c <= columnsDef.length; c++) {
    const cell = ws.getCell(totalsRowNumber, c);
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFE2E8F0" } };
    cell.font = { name: "Segoe UI", size: 10, bold: true };
    cell.border = {
      top: { style: "thin", color: { argb: "FF94A3B8" } },
      left: { style: "thin", color: { argb: "FFE2E8F0" } },
      bottom: { style: "double", color: { argb: "FF0F172A" } },
      right: { style: "thin", color: { argb: "FFE2E8F0" } }
    };
  }

  // -------------------------------------------------------------
  // HOJA 2: Resumen Ejecutivo y Estadísticas
  // -------------------------------------------------------------
  const summaryWs = wb.addWorksheet("Resumen Ejecutivo");

  summaryWs.mergeCells("A1:F1");
  const sTitle = summaryWs.getCell("A1");
  sTitle.value = "PLANETOUR CRM - RESUMEN EJECUTIVO DE AGENCIAS Y CARTERA";
  sTitle.font = { name: "Segoe UI", size: 13, bold: true, color: { argb: "FFFFFFFF" } };
  sTitle.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF132238" } };
  sTitle.alignment = { vertical: "middle", horizontal: "center" };
  summaryWs.getRow(1).height = 32;

  summaryWs.mergeCells("A2:F2");
  const sSub = summaryWs.getCell("A2");
  sSub.value = `Corte estadístico al ${fechaGeneracion}`;
  sSub.font = { name: "Segoe UI", size: 9.5, italic: true, color: { argb: "FFE0F2FE" } };
  sSub.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1E3A5F" } };
  sSub.alignment = { vertical: "middle", horizontal: "center" };
  summaryWs.getRow(2).height = 20;

  // Métricas agregadas
  const typeStats = clients.reduce((acc, c) => {
    const t = c.type || "AGENCY";
    acc[t] = (acc[t] || 0) + 1;
    return acc;
  }, {});

  const statusStats = clients.reduce((acc, c) => {
    const s = c.status || "ACTIVE";
    acc[s] = (acc[s] || 0) + 1;
    return acc;
  }, {});

  const tierStats = clients.reduce((acc, c) => {
    const tr = c.tier || "GOLD";
    acc[tr] = (acc[tr] || 0) + 1;
    return acc;
  }, {});

  const totalCreditLimit = clients.reduce((acc, c) => acc + Number(c.creditLimit || c.credit_limit || 0), 0);
  const totalKaringBalance = clients.reduce((acc, c) => acc + Number(c.karingBalance || c.karing_balance || 0), 0);
  const totalAvailableCredit = Math.max(0, totalCreditLimit - totalKaringBalance);

  // Tabla 1: Resumen Global de Cartera (Filas 4-8)
  summaryWs.getCell("A4").value = "INDICADOR FINANCIERO GLOBAL";
  summaryWs.getCell("A4").font = { name: "Segoe UI", size: 10, bold: true, color: { argb: "FFFFFFFF" } };
  summaryWs.getCell("A4").fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF0F172A" } };
  summaryWs.mergeCells("A4:C4");

  summaryWs.getCell("D4").value = "VALOR (COP)";
  summaryWs.getCell("D4").font = { name: "Segoe UI", size: 10, bold: true, color: { argb: "FFFFFFFF" } };
  summaryWs.getCell("D4").fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF0F172A" } };
  summaryWs.mergeCells("D4:F4");

  const kpis = [
    { label: "Total Límite de Crédito Otorgado", value: totalCreditLimit, fmt: '"$"#,##0' },
    { label: "Total Cartera Activa (Saldo Karing)", value: totalKaringBalance, fmt: '"$"#,##0' },
    { label: "Cupo de Crédito Disponible Global", value: totalAvailableCredit, fmt: '"$"#,##0' },
    { label: "Total Agencias y Clientes Registrados", value: clients.length, fmt: '#,##0' }
  ];

  kpis.forEach((kpi, i) => {
    const r = 5 + i;
    summaryWs.mergeCells(`A${r}:C${r}`);
    summaryWs.mergeCells(`D${r}:F${r}`);
    const lbl = summaryWs.getCell(`A${r}`);
    lbl.value = kpi.label;
    lbl.font = { name: "Segoe UI", size: 9.5, bold: i === 3 };
    lbl.border = BORDER_THIN;
    lbl.alignment = { vertical: "middle", horizontal: "left" };

    const val = summaryWs.getCell(`D${r}`);
    val.value = kpi.value;
    val.numFmt = kpi.fmt;
    val.font = { name: "Segoe UI", size: 10, bold: true };
    val.border = BORDER_THIN;
    val.alignment = { vertical: "middle", horizontal: "right" };
  });

  // Tabla 2: Distribución por Tipo de Cliente (Fila 10)
  summaryWs.getCell("A10").value = "DISTRIBUCIÓN POR TIPO DE CLIENTE";
  summaryWs.getCell("A10").font = { name: "Segoe UI", size: 10, bold: true, color: { argb: "FFFFFFFF" } };
  summaryWs.getCell("A10").fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF0F172A" } };
  summaryWs.mergeCells("A10:C10");

  summaryWs.getCell("D10").value = "CANTIDAD";
  summaryWs.getCell("D10").font = { name: "Segoe UI", size: 10, bold: true, color: { argb: "FFFFFFFF" } };
  summaryWs.getCell("D10").fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF0F172A" } };
  summaryWs.mergeCells("D10:F10");

  const typeRows = [
    { label: "Agencias Minoristas (AGENCY)", count: typeStats.AGENCY || 0 },
    { label: "Convenios Estatales (GOVERNMENT)", count: typeStats.GOVERNMENT || 0 },
    { label: "Clientes Corporativos (CORPORATE)", count: typeStats.CORPORATE || 0 }
  ];

  typeRows.forEach((tr, i) => {
    const r = 11 + i;
    summaryWs.mergeCells(`A${r}:C${r}`);
    summaryWs.mergeCells(`D${r}:F${r}`);
    summaryWs.getCell(`A${r}`).value = tr.label;
    summaryWs.getCell(`A${r}`).font = { name: "Segoe UI", size: 9.5 };
    summaryWs.getCell(`A${r}`).border = BORDER_THIN;

    const val = summaryWs.getCell(`D${r}`);
    val.value = tr.count;
    val.font = { name: "Segoe UI", size: 10, bold: true };
    val.alignment = { vertical: "middle", horizontal: "right" };
    val.border = BORDER_THIN;
  });

  // Tabla 3: Distribución por Estado Operativo (Fila 15)
  summaryWs.getCell("A15").value = "ESTADO OPERATIVO DE CUENTAS";
  summaryWs.getCell("A15").font = { name: "Segoe UI", size: 10, bold: true, color: { argb: "FFFFFFFF" } };
  summaryWs.getCell("A15").fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF0F172A" } };
  summaryWs.mergeCells("A15:C15");

  summaryWs.getCell("D15").value = "CANTIDAD";
  summaryWs.getCell("D15").font = { name: "Segoe UI", size: 10, bold: true, color: { argb: "FFFFFFFF" } };
  summaryWs.getCell("D15").fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF0F172A" } };
  summaryWs.mergeCells("D15:F15");

  const statusRows = [
    { label: "Activas", count: statusStats.ACTIVE || 0 },
    { label: "En Advertencia", count: statusStats.WARNING || 0 },
    { label: "Bloqueadas por Cartera", count: statusStats.BLOCKED || 0 },
    { label: "Inactivas", count: statusStats.INACTIVE || 0 }
  ];

  statusRows.forEach((sr, i) => {
    const r = 16 + i;
    summaryWs.mergeCells(`A${r}:C${r}`);
    summaryWs.mergeCells(`D${r}:F${r}`);
    summaryWs.getCell(`A${r}`).value = sr.label;
    summaryWs.getCell(`A${r}`).font = { name: "Segoe UI", size: 9.5 };
    summaryWs.getCell(`A${r}`).border = BORDER_THIN;

    const val = summaryWs.getCell(`D${r}`);
    val.value = sr.count;
    val.font = { name: "Segoe UI", size: 10, bold: true };
    val.alignment = { vertical: "middle", horizontal: "right" };
    val.border = BORDER_THIN;
  });

  // Tabla 4: Distribución por Categoría / Tier (Fila 21)
  summaryWs.getCell("A21").value = "CATEGORÍA / TIER";
  summaryWs.getCell("A21").font = { name: "Segoe UI", size: 10, bold: true, color: { argb: "FFFFFFFF" } };
  summaryWs.getCell("A21").fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF0F172A" } };
  summaryWs.mergeCells("A21:C21");

  summaryWs.getCell("D21").value = "CANTIDAD";
  summaryWs.getCell("D21").font = { name: "Segoe UI", size: 10, bold: true, color: { argb: "FFFFFFFF" } };
  summaryWs.getCell("D21").fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF0F172A" } };
  summaryWs.mergeCells("D21:F21");

  const tierRows = [
    { label: "GOLD (Alta Emisión)", count: tierStats.GOLD || 0 },
    { label: "SILVER (Estándar)", count: tierStats.SILVER || 0 },
    { label: "BRONZE (Ocasional)", count: tierStats.BRONZE || 0 },
    { label: "ESTATAL (Convenios)", count: tierStats.ESTATAL || 0 }
  ];

  tierRows.forEach((tr, i) => {
    const r = 22 + i;
    summaryWs.mergeCells(`A${r}:C${r}`);
    summaryWs.mergeCells(`D${r}:F${r}`);
    summaryWs.getCell(`A${r}`).value = tr.label;
    summaryWs.getCell(`A${r}`).font = { name: "Segoe UI", size: 9.5 };
    summaryWs.getCell(`A${r}`).border = BORDER_THIN;

    const val = summaryWs.getCell(`D${r}`);
    val.value = tr.count;
    val.font = { name: "Segoe UI", size: 10, bold: true };
    val.alignment = { vertical: "middle", horizontal: "right" };
    val.border = BORDER_THIN;
  });

  summaryWs.getColumn("A").width = 25;
  summaryWs.getColumn("B").width = 15;
  summaryWs.getColumn("C").width = 15;
  summaryWs.getColumn("D").width = 15;
  summaryWs.getColumn("E").width = 15;
  summaryWs.getColumn("F").width = 15;

  // -------------------------------------------------------------
  // Generar buffer y descargar archivo en el navegador
  // -------------------------------------------------------------
  const buffer = await wb.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
  });

  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  const fileNameDate = now.toISOString().slice(0, 10);
  a.href = url;
  a.download = `Directorio_Agencias_Planetour_${fileNameDate}.xlsx`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);

  return {
    success: true,
    fileName: `Directorio_Agencias_Planetour_${fileNameDate}.xlsx`,
    count: clients.length
  };
}
