/* =========================================================
   CÁLCULO DE VALOR PRESENTE NETO (VPN)
   ---------------------------------------------------------
   Replica la misma lógica que el formato Excel de VPN que
   antes se subía como archivo adjunto:

   - Capital Humano total = Σ (horas × salario diario ÷ 8)
   - Inversiones total    = Σ montos capturados
   - Costos total         = Σ montos capturados
   - Beneficios total     = Σ montos capturados
   - Flujo neto mensual   = Beneficios total − Costos total
   - Inversión            = Capital Humano total + Inversiones total
   - VPN = NPV(tasa anual ÷ 12, flujo mensual × meses) − Inversión
   ========================================================= */

function aNumero(valor) {

    const numero =
        Number(
            valor
        );

    return Number.isFinite(numero)
        ? numero
        : 0;

}


function sumarMontos(filas) {

    return (
        filas ||
        []
    ).reduce(
        (total, fila) =>
            total +
            aNumero(
                fila.total
            ),
        0
    );

}


export function calcularVPN({
    tasaDescuentoAnual,
    mesesProyeccion,
    capitalHumano,
    inversiones,
    costos,
    beneficios
}) {

    const capitalHumanoTotal =
        (
            capitalHumano ||
            []
        ).reduce(
            (total, fila) =>
                total +
                (
                    aNumero(fila.horas) *
                    aNumero(fila.salarioDiario)
                ) / 8,
            0
        );


    const inversionesTotal =
        sumarMontos(
            inversiones
        );


    const costosTotal =
        sumarMontos(
            costos
        );


    const beneficiosTotal =
        sumarMontos(
            beneficios
        );


    const flujoNetoMensual =
        beneficiosTotal -
        costosTotal;


    const inversionTotal =
        capitalHumanoTotal +
        inversionesTotal;


    const meses =
        aNumero(mesesProyeccion) ||
        36;


    const tasaMensual =
        aNumero(tasaDescuentoAnual) /
        100 /
        12;


    let valorPresenteFlujos =
        0;

    for (
        let mes = 1;
        mes <= meses;
        mes++
    ) {

        valorPresenteFlujos +=
            flujoNetoMensual /
            Math.pow(
                1 + tasaMensual,
                mes
            );

    }


    const resultadoVPN =
        valorPresenteFlujos -
        inversionTotal;


    return {

        capitalHumanoTotal,
        inversionesTotal,
        costosTotal,
        beneficiosTotal,
        flujoNetoMensual,
        inversionTotal,
        resultadoVPN

    };

}
