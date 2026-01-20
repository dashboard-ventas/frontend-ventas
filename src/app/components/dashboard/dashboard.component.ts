import {Component, OnInit, Inject, PLATFORM_ID, ChangeDetectorRef} from "@angular/core";
import { CommonModule, isPlatformBrowser } from "@angular/common";
import { FormsModule } from '@angular/forms';
import { BaseChartDirective } from 'ng2-charts';
import { Chart, registerables, ChartConfiguration, ChartData, ChartType } from "chart.js";
import { ApiService, Categoria, Marca, Venta } from "../../services/api.service";

@Component({
    selector: 'app-dashboard',
    standalone: true,
    imports: [CommonModule, FormsModule, BaseChartDirective],
    styleUrls: ['./dashboard.component.css'],
    templateUrl: './dashboard.component.html'
})
export class DashboardComponent implements OnInit {
    isBrowser: boolean = false;

    mostrarModal: boolean = false;
    mostrarModalMeta: boolean = false;

    categorias: Categoria[] = [];
    marcas: Marca[] = [];

    marcasDashboard: Marca[] = [];
    marcasFormulario: Marca[] = [];

    historialVentas: any[] = [];
    progresoMetas: any[] = [];

    filtros = {
        categoriaId: '',
        marcaId: '',
        mes: '',
    };

    formulario = {
        fecha: '',
        categoriaId: '',
        marcaId: '',
        monto: 0,
        cantidad: 1
    };

    formularioMeta = {
        marcaId: '',
        nuevoMonto: 0
    };

    paginaActual: number = 1;
    itemsPorPag: number = 10;

    public barChartOptions: ChartConfiguration['options'] = {
        responsive: true,
        maintainAspectRatio: false,
        scales: {
            y: {
                type: 'linear',
                display: true,
                position: 'left',
                title: { display: true, text: 'Monto (S/.)' },
                beginAtZero: true
            },
            y1: {
                type: 'linear',
                display: true,
                position: 'right',
                title: { display: true, text: 'Cantidad (Unid.)' },
                grid: {
                    drawOnChartArea: false,
                },
            },
        },
        plugins: {
            legend: { display: true }
        }
    };

    public barChartType: ChartType = 'bar';
    public barChartData: ChartData<'bar' | 'line'> = {
        labels: [],
        datasets: []
    };

    constructor(
        private api: ApiService,
        @Inject(PLATFORM_ID) private platformId: Object,
        private cdr: ChangeDetectorRef
    ) {
        Chart.register(...registerables);
        this.isBrowser = isPlatformBrowser(this.platformId);
    }

    ngOnInit(): void {
        if (this.isBrowser) {
            this.cargarConfiguration();
            this.actualizarDashboard();
        }
    }

    cargarConfiguration() {
        this.api.getConfig().subscribe(data => {
            this.categorias = data.categorias;
            this.marcas = data.marcas;
            this.marcasDashboard = data.marcas;
            this.actualizarDashboard();

            this.cdr.detectChanges();
        });
    }

    onFiltroCategoriaChange() {
        if (this.filtros.categoriaId) {
            this.marcasDashboard = this.marcas.filter(m => m.categoriaId === this.filtros.categoriaId);
        } else {
            this.marcasDashboard = this.marcas;
        }
        this.filtros.marcaId = '';
    }

    aplicarFiltros(){
        this.paginaActual = 1;
        this.actualizarDashboard();
    }

    actualizarDashboard(){
        this.api.getVentas().subscribe((ventas) => {
            let data = ventas;

            if(this.filtros.categoriaId) {
                data = data.filter(v => v.categoriaId === this.filtros.categoriaId);
            }
            if(this.filtros.marcaId) {
                data = data.filter(v => v.marcaId === this.filtros.marcaId);
            }
            if(this.filtros.mes) {
                data = data.filter(v => v.fecha.startsWith(this.filtros.mes));
            }
            this.historialVentas = data.map(v => ({
                fecha: v.fecha.split('T')[0],
                marca: this.marcas.find(m => m.id === v.marcaId)?.nombre || 'Desconocida',
                monto: v.monto,
                cantidad: v.cantidad
            }));

            const agrupado: { [key:string]: { monto: number, cantidad: number } } = {};

            data.forEach(venta => {
                const marcaInfo = this.marcas.find(m => m.id === venta.marcaId);
                const nombreMarca = marcaInfo?.nombre || 'Otros';

                if (!agrupado[nombreMarca]) agrupado[nombreMarca] = { monto: 0, cantidad: 0 };

                agrupado[nombreMarca].monto += Number(venta.monto);
                agrupado[nombreMarca].cantidad += Number(venta.cantidad);
            });

            const etiquetas = Object.keys(agrupado);
            this.barChartData = {
                labels : etiquetas,
                datasets: [
                    {
                        data: etiquetas.map(l => agrupado[l].monto),
                        label: 'Ventas (S/.)',
                        type: 'bar',
                        yAxisID: 'y',
                        backgroundColor: 'rgba(59, 130, 246, 0.6)',
                        borderColor: 'rgba(59, 130, 246, 1)',
                        borderWidth: 1
                    },
                    {
                        data: etiquetas.map(l => agrupado[l].cantidad),
                        label: 'Cantidad',
                        type: 'line',
                        yAxisID: 'y1',
                        borderColor: 'rgba(239, 68, 68, 1)',
                        backgroundColor: 'rgba(239, 68, 68, 0.5)',
                        pointBackgroundColor: 'white',
                        pointBorderColor: 'rgba(239, 68, 68, 1)',
                        pointRadius: 4,
                        tension: 0.3
                    }
                ]
            };

            this.progresoMetas = this.marcasDashboard.map(marca => {
                const ventasRealizadas = agrupado[marca.nombre]?.monto || 0;
                const meta = marca.meta || 0;
                const porcentaje = meta > 0 ? Math.min((ventasRealizadas / meta) * 100, 100) : 0;

                return {
                    nombre: marca.nombre,
                    ventas: ventasRealizadas,
                    meta: meta,
                    porcentaje: porcentaje,
                    cumplido: ventasRealizadas >= meta && meta > 0
                };
            }).sort((a, b) => b.porcentaje - a.porcentaje);
            this.cdr.detectChanges();
        });
    }

    get ventasPaginadas(){
        const inicio = (this.paginaActual -1)* this.itemsPorPag;
        return this.historialVentas.slice(inicio, inicio + this.itemsPorPag);
    }

    cambiarPagina(delta: number){
        this.paginaActual += delta;
    }

    get totalPaginas(){
        return Math.ceil(this.historialVentas.length / this.itemsPorPag);
    }

    abrirModal(){
        this.formulario = {
            fecha: new Date().toISOString().split('T')[0],
            categoriaId: '',
            marcaId: '',
            monto: 0,
            cantidad: 1,
        };
        this.marcasFormulario = [];
        this.mostrarModal = true;
    }

    abrirModalMeta(){
        this.formularioMeta = { marcaId: '', nuevoMonto: 0 };
        this.mostrarModalMeta = true;
    }

    cerrarModales() {
        this.mostrarModal = false;
        this.mostrarModalMeta = false;
    }

    guardarMeta(){
        if(!this.formularioMeta.marcaId || this.formularioMeta.nuevoMonto <= 0){
            alert("Seleccione una marca y monto válido");
            return;
        }
        this.api.updateMeta(this.formularioMeta.marcaId, this.formularioMeta.nuevoMonto).subscribe({
            next: () => {
                alert("Meta actualizada");
                const marca = this.marcas.find(m => m.id === this.formularioMeta.marcaId);
                if(marca) marca.meta = this.formularioMeta.nuevoMonto;

                this.cerrarModales();
                this.actualizarDashboard();
                if(this.isBrowser){
                    window.location.reload();
                }
            },
            error: (e) => alert("Error: " + e.message)
        });
    }

    onFormCategoriaChange(){
        if(this.formulario.categoriaId){
            this.marcasFormulario = this.marcas.filter(m => m.categoriaId === this.formulario.categoriaId);
        } else{
            this.marcasFormulario = [];
        }
        this.formulario.marcaId = '';
    }

    guardarVenta() {
        if (!this.formulario.fecha || !this.formulario.categoriaId || !this.formulario.marcaId || this.formulario.monto <= 0) {
            alert("Por favor completa todos los campos correctamente");
            return;
        }

        const nuevaVenta: Venta = {
            fecha: this.formulario.fecha,
            monto: this.formulario.monto,
            cantidad: this.formulario.cantidad,
            categoriaId: this.formulario.categoriaId,
            marcaId: this.formulario.marcaId
        };

        this.api.addVenta(nuevaVenta).subscribe({
            next: () => {
                alert("Venta registrada");
                if(this.isBrowser){
                    window.location.reload();
                }
            },
            error:(err) => {
                console.error(err);
                alert("Error al guardad: " + (err.error?.message || err.message));
            }
        });
    }
}
