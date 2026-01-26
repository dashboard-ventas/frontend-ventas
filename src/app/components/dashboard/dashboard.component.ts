import {Component, OnInit, Inject, PLATFORM_ID, ChangeDetectorRef, AfterViewInit} from "@angular/core";
import { CommonModule, isPlatformBrowser } from "@angular/common";
import { FormsModule } from '@angular/forms';
import { Line, Column } from '@antv/g2plot';
import {Chart, registerables, ChartConfiguration, ChartType} from "chart.js";
import { ApiService, Categoria, Marca, DesempenoMes, HistorialLog } from "../../services/api.service";

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

  paginaActual: number = 1;
  itemsPorPagina: number = 10;

  filtrosGrafico = {
    marcasSeleccionadas: [] as string[],
    mesesSeleccionados: [] as number[],
    metricas: 'monto',
    tipoGrafico: 'line'
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

  private chartPlot: any | undefined;

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
      this.filtrosGrafico.mesesSeleccionados = Array.from({length: 12}, (_, i) => i + 1);
      this.cargarDatosIniciales();
    }
  }

  get historialPaginado(): HistorialLog[] {
    const inicio = (this.paginaActual - 1) * this.itemsPorPagina;
    const fin = inicio + this.itemsPorPagina;
    return this.historial.slice(inicio, fin);
  }

  get totalPaginas(): number {
    return Math.ceil(this.historial.length / this.itemsPorPagina);
  }

  cambiarPagina(delta: number) {
    const nuevaPagina = this.paginaActual + delta;
    if (nuevaPagina >= 1 && nuevaPagina <= this.totalPaginas) {
      this.paginaActual = nuevaPagina;
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
        let datosLimpios: DesempenoMes[] = [];

        if (Array.isArray(response)) {
          datosLimpios = response;
        } else if (response && Array.isArray(response.data)) {
          datosLimpios = response.data;
        }

        this.dataDesempeno = datosLimpios;
        this.actualizarGrafico();

        if (this.marcaSeleccionadaId) {
          this.prepararDatosTabla(this.marcaSeleccionadaId);
        }

        this.cdr.detectChanges();
      },
      error: (err) => {
        console.error('Error API Desempeño:', err);
        this.dataDesempeno = [];
        this.actualizarGrafico();
      }
    });

    this.api.getHistorial().subscribe({
      next: (r: any) => {
        this.historial = Array.isArray(r) ? r : r.data || [];

        this.cdr.detectChanges();
      },
      error: (err) => console.error('Error API Historial', err)
    });
  }

  ngAfterViewInit() {
    if (this.isBrowser && this.dataDesempeno.length > 0) {
      this.actualizarGrafico();
    }
  }

  actualizarGrafico() {
    if (!this.isBrowser) return;

    let datosParaGraficar = [...this.dataDesempeno];

    if (this.marcaSeleccionadaId && this.datosTabla.length > 0) {
      datosParaGraficar = datosParaGraficar.filter(d => d.marcaId !== this.marcaSeleccionadaId);

      const marcaActual = this.marcas.find(m => m.id === this.marcaSeleccionadaId);

      this.datosTabla.forEach(fila => {
        datosParaGraficar.push({
          marcaId: this.marcaSeleccionadaId,
          anio: this.anioActual,
          mes: fila.mesIndex,
          ventaReal: fila.ventaReal || 0,
          unidades: fila.unidades || 0,
          meta: fila.meta || 0,
          // @ts-ignore
          nombreMarca: marcaActual?.nombre
        });
      });
    }

    const dataParaG2: any[] = [];
    const marcasActivas = this.marcas.filter(m => this.filtrosGrafico.marcasSeleccionadas.includes(m.id));

    marcasActivas.forEach(marca => {
      const datosMarca = datosParaGraficar.filter(d => d.marcaId === marca.id);

      this.meses.forEach((nombreMes, index) => {
        const numMes = index + 1;
        if (!this.filtrosGrafico.mesesSeleccionados.includes(numMes)) return;

        const registro = datosMarca.find(d => d.mes === numMes);
        let valor = 0;

        if (registro) {
          valor = this.filtrosGrafico.metricas === 'monto' ? Number(registro.ventaReal) : Number(registro.unidades);
        }

        dataParaG2.push({
          mes: nombreMes,
          valor: valor,
          marca: marca.nombre,
          rawMes: numMes
        });
      });
    });

    const contenedor = document.getElementById('containerG2');
    if (!contenedor) return;
    if (this.chartPlot) { this.chartPlot.destroy(); }

    const commonConfig = {
      data: dataParaG2,
      xField: 'mes',
      yField: 'valor',
      seriesField: 'marca',
      animation: false,
      legend: { position: 'top' },
      color: ['#5B8FF9', '#5AD8A6', '#5D7092', '#F6BD16', '#E8684A', '#6DC8EC', '#9270CA'],
      xAxis: { label: { style: { fill: '#6b7280', fontSize: 12 } } },
      yAxis: {
        label: {
          formatter: (v: any) => this.filtrosGrafico.metricas === 'monto' ? `S/. ${v}` : `${v}`,
          style: { fill: '#6b7280', fontSize: 12 }
        }
      },
      tooltip: {
        formatter: (datum: any) => {
          return {
            name: datum.marca,
            value: this.filtrosGrafico.metricas === 'monto' ? `S/. ${datum.valor}` : `${datum.valor} und.`
          };
        },
      }
    };

    if (this.filtrosGrafico.tipoGrafico === 'column') {
      // @ts-ignore
      this.chartPlot = new Column(contenedor, { ...commonConfig, isGroup: true, columnStyle: { radius: [4, 4, 0, 0] } });
    } else {
      // @ts-ignore
      this.chartPlot = new Line(contenedor, { ...commonConfig, point: { size: 4, shape: 'circle' } });
    }
    this.chartPlot.render();
  }

  toggleMetrica() {
    this.filtrosGrafico.metricas = this.filtrosGrafico.metricas === 'monto' ? 'unidades' : 'monto';
    this.actualizarGrafico();
  }

  toggleTipoGrafico(tipo: 'line' | 'column') {
    this.filtrosGrafico.tipoGrafico = tipo;
    this.actualizarGrafico();
  }

  toggleMarcaFiltro(marcaId: string) {
    const index = this.filtrosGrafico.marcasSeleccionadas.indexOf(marcaId);
    if (index >= 0) this.filtrosGrafico.marcasSeleccionadas.splice(index, 1);
    else this.filtrosGrafico.marcasSeleccionadas.push(marcaId);
    this.actualizarGrafico();
  }

  toggleMesFiltro(mesIndex: number) {
    const numMes = mesIndex + 1;
    const index = this.filtrosGrafico.mesesSeleccionados.indexOf(numMes);
    if (index >= 0) this.filtrosGrafico.mesesSeleccionados.splice(index, 1);
    else {
      this.filtrosGrafico.mesesSeleccionados.push(numMes);
      this.filtrosGrafico.mesesSeleccionados.sort((a, b) => a - b);
    }
    this.actualizarGrafico();
  }

  toggleTodosMeses(seleccionar: boolean) {
    if (seleccionar) {
      this.filtrosGrafico.mesesSeleccionados = Array.from({length: 12}, (_, i) => i + 1);
    } else {
      this.filtrosGrafico.mesesSeleccionados = [];
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

    this.cambiosSinGuardar = false;

    this.datosTabla = Array.from({ length: 12 }, (_, i) => ({
      mesIndex: i + 1,
      mesNombre: this.meses[i],
      ventaReal: 0,
      unidades: 0,
      meta: 0,
      variacion: 0,
      score: 0,
      editado: false,
      original: { ventaReal: 0, unidades: 0, meta: 0 }
    }));

    const datosMarca = this.dataDesempeno.filter(d => d.marcaId === marcaId);
    datosMarca.forEach(d => {
      const index = d.mes - 1;
      if (index >= 0 && index < 12) {
        this.datosTabla[index].ventaReal = d.ventaReal;
        this.datosTabla[index].unidades = d.unidades;
        this.datosTabla[index].meta = d.meta;

        this.datosTabla[index].original = {
          ventaReal: d.ventaReal,
          unidades: d.unidades,
          meta: d.meta
        };

        this.calcularIndicadores(this.datosTabla[index]);
      }
    });
  }

  onCeldaChange(fila: any) {
    const haCambiado =
      fila.ventaReal !== fila.original.ventaReal ||
      fila.unidades !== fila.original.unidades ||
      fila.meta !== fila.original.meta;

    fila.editado = haCambiado;

    this.cambiosSinGuardar = this.datosTabla.some(f => f.editado);

    this.calcularIndicadores(fila);

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
    const cambios: any[] = [];
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
          meta: fila.meta,

          valorAnteriorVenta: fila.original.ventaReal,
          valorAnteriorUnidades: fila.original.unidades,
          valorAnteriorMeta: fila.original.meta
        });
      }
    });

    if (cambios.length === 0) return;

    this.api.saveDesempenoBatch(cambios).subscribe({
      next: () => {
        this.cambiosSinGuardar = false;

        alert('Cambios guardados correctamente');

        this.recargarDatos();
      },
      error: (err) => alert('Error al guardar: ' + err.message)
    });
  }
}
