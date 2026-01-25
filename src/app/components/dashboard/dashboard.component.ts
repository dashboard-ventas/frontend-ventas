import {Component, OnInit, Inject, PLATFORM_ID, ChangeDetectorRef, AfterViewInit} from "@angular/core";
import { CommonModule, isPlatformBrowser } from "@angular/common";
import { FormsModule } from '@angular/forms';
import { Line } from '@antv/g2plot';
import {Chart, registerables, ChartConfiguration, ChartType} from "chart.js";
import { ApiService, Categoria, Marca, DesempenoMes, CambioDesempeno, HistorialLog } from "../../services/api.service";

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './dashboard.component.html',
  styleUrls: ['./dashboard.component.css']
})
export class DashboardComponent implements OnInit, AfterViewInit {
  isBrowser: boolean = false;
  anioActual: number = new Date().getFullYear();
  meses = ['ENE', 'FEB', 'MAR', 'ABR', 'MAY', 'JUN', 'JUL', 'AGO', 'SEPT', 'OCT', 'NOV', 'DIC'];

  categorias: Categoria[] = [];
  marcas: Marca[] = [];

  dataDesempeno: DesempenoMes[] = [];
  historial: HistorialLog[] = [];

  filtrosGrafico = {
    marcasSeleccionadas: [] as string[],
    metricas: 'monto',
  };

  marcaSeleccionadaId: string = "";
  datosTabla: any[] = [];
  cambiosSinGuardar: boolean = false;

  public lineChartType: ChartType = 'line';
  public lineChartData: ChartConfiguration['data'] = { datasets: [], labels: [] };
  public lineChartOptions: ChartConfiguration['options'] = {
    responsive: true,
    maintainAspectRatio: false,
    elements: {
      line: { tension: 0.4 }
    },
    interaction: {
      mode: 'index',
      intersect: false,
    },
    plugins: {
      legend: { display: true },
    }
  };

  private linePlot: Line | undefined;

  constructor(
    private api: ApiService,
    @Inject(PLATFORM_ID)private platformId: Object,
    private cdr: ChangeDetectorRef
  ) {
    Chart.register(...registerables);
    this.isBrowser = isPlatformBrowser(this.platformId);
  }

  ngOnInit(): void {
    if (this.isBrowser) {
      this.cargarDatosIniciales();
    }
  }

  cargarDatosIniciales(){
    this.api.getConfig().subscribe((config) => {
      this.categorias = config.categorias;
      this.marcas = config.marcas;

      this.filtrosGrafico.marcasSeleccionadas = this.marcas.map(m => m.id);

      this.recargarDatos();
    });
  }

  recargarDatos() {
    this.api.getDesempeno(this.anioActual).subscribe({
      next: (response: any) => {
        let datosLimpios = [];

        if (Array.isArray(response)) {
          datosLimpios = response;
        } else if (response && Array.isArray(response.data)) {
          console.log('Detectada respuesta envuelta en .data, extrayendo...');
          datosLimpios = response.data;
        } else {
          console.warn('Formato desconocido, se usará lista vacía.');
        }

        this.dataDesempeno = datosLimpios;
        this.actualizarGrafico();

        if (this.marcaSeleccionadaId) {
          this.prepararDatosTabla(this.marcaSeleccionadaId);
        }
        this.cdr.detectChanges();
      },
      error: (err) => {
        console.error('Error API:', err);
        this.dataDesempeno = [];
        this.actualizarGrafico();
      }
    });

    this.api.getHistorial().subscribe({
      next: (response: any) => {
        if (Array.isArray(response)) {
          this.historial = response;
        } else if (response && Array.isArray(response.data)) {
          this.historial = response.data;
        } else {
          this.historial = [];
        }
        this.cdr.detectChanges();
      },
      error: (err) => console.error(err)
    });
  }

  ngAfterViewInit() {
    if (this.isBrowser && this.dataDesempeno.length > 0) {
      this.actualizarGrafico();
    }
  }

  actualizarGrafico() {
    if (!this.isBrowser) return;

    const dataParaG2: any[] = [];

    const marcasActivas = this.marcas.filter(m =>
      this.filtrosGrafico.marcasSeleccionadas.includes(m.id)
    );

    marcasActivas.forEach(marca => {
      const datosMarca = this.dataDesempeno.filter(d => d.marcaId === marca.id);

      this.meses.forEach((nombreMes, index) => {
        const numMes = index + 1;

        const registro = datosMarca.find(d => d.mes === numMes);

        let valor = 0;
        if (registro) {
          valor = this.filtrosGrafico.metricas === 'monto' ? registro.ventaReal : registro.unidades;
        }

        dataParaG2.push({
          mes: nombreMes,
          valor: valor,
          marca: marca.nombre
        });
      });
    });

    const contenedor = document.getElementById('containerG2');
    if (!contenedor) return;

    // Si ya existe, destruirlo para evitar conflictos de renderizado previos
    if (this.linePlot) {
      this.linePlot.destroy();
    }

    this.linePlot = new Line(contenedor, {
      data: dataParaG2,
      xField: 'mes',
      yField: 'valor',
      seriesField: 'marca',

      // 1. SOLUCIÓN AL CRASH: Desactivamos animación compleja
      animation: false,

      // 2. SOLUCIÓN EJES INVISIBLES: Configuramos explícitamente los ejes
      xAxis: {
        label: {
          autoHide: false,
          autoRotate: false,
          style: {
            fill: '#6b7280', // Color gris visible
            fontSize: 12
          }
        },
        line: {
          style: {
            stroke: '#e5e7eb',
            lineWidth: 1
          }
        }
      },
      yAxis: {
        grid: {
          line: {
            style: {
              lineDash: [4, 4],
              stroke: '#e5e7eb'
            }
          }
        },
        label: {
          // Formateador para el eje Y (S/. o Unidades)
          formatter: (v: any) => {
            return this.filtrosGrafico.metricas === 'monto'
              ? `S/. ${v}`
              : `${v}`;
          },
          style: {
            fill: '#6b7280',
            fontSize: 12
          }
        }
      },

      legend: {
        position: 'top',
      },
      color: ['#5B8FF9', '#5AD8A6', '#5D7092', '#F6BD16', '#E8684A', '#6DC8EC', '#9270CA'],

      tooltip: {
        formatter: (datum: any) => {
          return {
            name: datum.marca,
            value: this.filtrosGrafico.metricas === 'monto' ? `S/. ${datum.valor}` : `${datum.valor} und.`
          };
        },
      },
      point: {
        size: 4,
        shape: 'circle',
        style: {
          fill: 'white',
          lineWidth: 2,
        },
      },
      // Habilita interacciones para que el tooltip fluya mejor
      interactions: [{ type: 'marker-active' }]
    });

    this.linePlot.render();
  }

  toggleMetrica() {
    this.filtrosGrafico.metricas = this.filtrosGrafico.metricas === 'monto' ? 'unidades' : 'monto';
    this.actualizarGrafico();
  }

  toggleMarcaFiltro(marcaId: string) {
    const index = this.filtrosGrafico.marcasSeleccionadas.indexOf(marcaId);
    if (index >= 0) {
      this.filtrosGrafico.marcasSeleccionadas.splice(index, 1);
    } else {
      this.filtrosGrafico.marcasSeleccionadas.push(marcaId);
    }
    this.actualizarGrafico();
  }

  onMarcaTablaChange() {
    this.prepararDatosTabla(this.marcaSeleccionadaId);
  }

  prepararDatosTabla(marcaId: string) {
    if (!marcaId) {
      this.datosTabla = [];
      return;
    }

    this.datosTabla = Array.from({ length: 12 }, (_, i) => ({
      mesIndex: i + 1,
      mesNombre: this.meses[i],
      ventaReal: 0,
      unidades: 0,
      meta: 0,
      variacion: 0,
      score: 0,
      editado: false
    }));

    const datosMarca = this.dataDesempeno.filter(d => d.marcaId === marcaId);
    datosMarca.forEach(d => {
      const index = d.mes - 1;
      if (index >= 0 && index < 12) {
        this.datosTabla[index].ventaReal = d.ventaReal;
        this.datosTabla[index].unidades = d.unidades;
        this.datosTabla[index].meta = d.meta;
        this.calcularIndicadores(this.datosTabla[index]);
      }
    });
  }

  onCeldaChange(fila: any) {
    fila.editado = true;
    this.cambiosSinGuardar = true;
    this.calcularIndicadores(fila);

    const itemGlobal = this.dataDesempeno.find(d => d.marcaId === this.marcaSeleccionadaId && d.mes === fila.mesIndex);
    if(itemGlobal) {
      itemGlobal.ventaReal = fila.ventaReal;
      itemGlobal.unidades = fila.unidades;
      itemGlobal.meta = fila.meta;
    } else {
      this.dataDesempeno.push({
        marcaId: this.marcaSeleccionadaId,
        anio: this.anioActual,
        mes: fila.mesIndex,
        ventaReal: fila.ventaReal,
        unidades: fila.unidades,
        meta: fila.meta
      });
    }
    this.actualizarGrafico();
  }

  calcularIndicadores(fila: any) {
    if (fila.meta > 0) {
      fila.variacion = ((fila.ventaReal - fila.meta) / fila.meta) * 100;
      fila.score = (fila.ventaReal / fila.meta) * 100;
    } else {
      fila.variacion = 0;
      fila.score = fila.ventaReal > 0 ? 100 : 0;
    }
  }

  guardarCambiosTabla() {
    const cambios: CambioDesempeno[] = [];
    const marca = this.marcas.find(m => m.id === this.marcaSeleccionadaId);

    this.datosTabla.forEach(fila => {
      if (fila.editado) {
        cambios.push({
          marcaId: this.marcaSeleccionadaId,
          nombreMarca: marca?.nombre || 'Desconocida',
          anio: this.anioActual,
          mes: fila.mesIndex,
          ventaReal: fila.ventaReal,
          unidades: fila.unidades,
          meta: fila.meta
        });
      }
    });

    if (cambios.length === 0) return;

    this.api.saveDesempenoBatch(cambios).subscribe({
      next: () => {
        alert('Cambios guardados correctamente');
        this.cambiosSinGuardar = false;
        this.recargarDatos();
      },
      error: (err) => alert('Error al guardar: ' + err.message)
    });
  }

  getColorParaMarca(id: string): string {
    let hash = 0;
    for (let i = 0; i < id.length; i++) {
      hash = id.charCodeAt(i) + ((hash << 5) - hash);
    }
    const c = (hash & 0x00FFFFFF).toString(16).toUpperCase();
    return '#' + '00000'.substring(0, 6 - c.length) + c;
  }
}
