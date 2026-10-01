const path = require("path");
require("dotenv").config({
  path: path.join(__dirname, "../../.env"),
});

const sql = require("mssql");
const mysql = require("mysql2/promise");

const sqlServer = new sql.ConnectionPool({
  server: process.env.SQLSERVER_HOST,
  port: Number(process.env.SQLSERVER_PORT || 1433),
  database: process.env.SQLSERVER_DATABASE,
  user: process.env.SQLSERVER_USER,
  password: process.env.SQLSERVER_PASSWORD,
  options: {
    tdsVersion: "7_3_A", // SQL Server 2008
    encrypt: process.env.SQLSERVER_ENCRYPT === "true",
    trustServerCertificate: true,
  },
});

const flowDb = mysql.createPool({
  host: process.env.DB_HOST,
  port: Number(process.env.DB_PORT || 3306),
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
});

async function sincronizar() {
  await sqlServer.connect();

  const { recordset: empleados } = await sqlServer.request().query(`
    SELECT DISTINCT
      pe.EmployeeId AS EmployeeID,
      pe.EmployeeName AS nombre,
      ss.SubsidiaryName AS departamento,
      sat.Description AS area,
      pe.Email AS correo_electronico,
      pe.IsActive AS activo
    FROM Pay_Employees pe
    JOIN Str_Subsidiaries ss
      ON pe.SubsidiaryId = ss.SubsidiaryId
    JOIN Pay_EmployeeCheckArea pea
      ON pea.EmployeeId = pe.EmployeeId
    JOIN Str_AreasOrTeams sat
      ON sat.AreaId = pea.AreaId
     AND sat.SubsidiaryId = ss.SubsidiaryId
  `);

  // La consulta puede devolver a una persona más de una vez
  // si tiene varias áreas. No elige una arbitrariamente.
  const idsOrigen = new Set();
  for (const empleado of empleados) {
    const id = String(empleado.EmployeeID);

    if (idsOrigen.has(id)) {
      throw new Error(
        `EmployeeID repetido en el origen (${id}); hay que resolver sus áreas antes de sincronizar.`
      );
    }

    idsOrigen.add(id);
  }

  const conexion = await flowDb.getConnection();

  try {
    await conexion.beginTransaction();

    let insertados = 0;
    let existentes = 0;

    for (const empleado of empleados) {
      const [coincidencias] = await conexion.execute(
        "SELECT 1 FROM usuarios WHERE EmployeeID = ? LIMIT 1",
        [empleado.EmployeeID]
      );

      if (coincidencias.length > 0) {
        existentes++;
        continue;
      }

      await conexion.execute(
        `INSERT INTO usuarios
          (EmployeeID, nombre, departamento, area, correo_electronico, password_hash, activo,
          fecha_registro, fecha_actualizacion, foto_mime, foto_contenido)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          empleado.EmployeeID,
          empleado.nombre,
          empleado.departamento,
          empleado.area,
          empleado.correo_electronico,
          null,
          0,
          null,
          null,
          null,
          null
        ]
      );

      insertados++;
    }

    await conexion.commit();
    console.log(`Sincronización terminada. Insertados: ${insertados}; ya existían: ${existentes}.`);
  } catch (error) {
    await conexion.rollback();
    throw error;
  } finally {
    conexion.release();
  }
}

sincronizar()
  .catch((error) => {
    console.error("Error al sincronizar usuarios:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await sqlServer.close();
    await flowDb.end();
  });