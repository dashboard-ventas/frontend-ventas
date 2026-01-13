import { Component, OnInit, Inject, PLATFORM_ID } from "@angular/core";
import { CommonModule, isPlatformBrowser } from "@angular/common";
import { FormsModule } from '@angular/forms';
import { BaseChartDirective } from 'ng2-charts';
import { Chart, registerables, ChartConfiguration, ChartData, ChartType } from "chart.js";
import { ApiService, Categoria, Marca, Venta } from "../../services/api.service";

@Component({
    selector: 'app-dashboard',
    standalone: true,
    imports: [CommonModule, FormsModule, BaseChartDirective],
    templateUrl: './dashboard.component.html'
})
export class DashboardComponent implements OnInit {
    isBrowser: boolean = false;

    categorias: Categoria[] = [];
    marcas: Marca[] = [];
    marcasFiltradas: Marca[] = [];

    filtros = {
        categoriaId: '',
        marcaId: '',
        monto: 0,
        cantidad: 1
    };

    public barChartOptions: ChartConfiguration['options'] = {
        responsive: true,
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
        @Inject(PLATFORM_ID) private platformId: Object
    ) {
        Chart.register(...registerables);
        this.isBrowser = isPlatformBrowser(this.platformId);
    }

    ngOnInit(): void {
        if (this.isBrowser) {
            this.cargarConfiguration();
            this.actualizarGrafico();
        }
    }

    cargarConfiguration() {
        this.api.getConfig().subscribe(data => {
            this.categorias = data.categorias;
            this.marcas = data.marcas;
        });
    }

    onCategoriaChange() {
        if (!this.filtros.categoriaId) {
            this.marcasFiltradas = [];
            this.filtros.marcaId = '';
        } else {
            this.marcasFiltradas = this.marcas.filter(m => m.categoriaId === this.filtros.categoriaId);
            this.filtros.marcaId = '';
        }
        this.actualizarGrafico();
    }

    registrarVenta() {
        if (!this.filtros.categoriaId || !this.filtros.marcaId || this.filtros.monto <= 0) {
            alert("Por favor completa todos los campos correctamente");
            return;
        }

        const nuevaVenta: Venta = {
            fecha: new Date().toISOString(),
            monto: this.filtros.monto,
            cantidad: this.filtros.cantidad,
            categoriaId: this.filtros.categoriaId,
            marcaId: this.filtros.marcaId
        };

        this.api.addVenta(nuevaVenta).subscribe(() => {
            alert("Venta registrada exitosamente");
            this.actualizarGrafico();
        });
    }

    actualizarGrafico() {
        this.api.getVentas().subscribe((ventas) => {
            let ventasFiltradas = ventas;

            if (this.filtros.categoriaId) {
                ventasFiltradas = ventasFiltradas.filter(v => v.categoriaId === this.filtros.categoriaId);
            }
            if (this.filtros.marcaId) {
                ventasFiltradas = ventasFiltradas.filter(v => v.marcaId === this.filtros.marcaId);
            }

            const agrupado: { [key: string]: { monto: number, cantidad: number } } = {};

            ventasFiltradas.forEach(venta => {
                const nombreMarca = this.marcas.find(m => m.id === venta.marcaId)?.nombre || 'Otros';

                if (!agrupado[nombreMarca]) {
                    agrupado[nombreMarca] = { monto: 0, cantidad: 0 };
                }

                agrupado[nombreMarca].monto += Number(venta.monto);
                agrupado[nombreMarca].cantidad += Number(venta.cantidad);
            });

            const etiquetas = Object.keys(agrupado);
            const datosMonto = etiquetas.map(lbl => agrupado[lbl].monto);
            const datosCantidad = etiquetas.map(lbl => agrupado[lbl].cantidad);

            this.barChartData = {
                labels: etiquetas,
                datasets: [
                    {
                        data: datosMonto,
                        label: 'Ventas (S/.)',
                        type: 'bar',
                        yAxisID: 'y',
                        backgroundColor: 'rgba(54, 162, 235, 0.6)',
                        borderColor: 'rgba(54, 162, 235, 1)',
                        borderWidth: 1
                    },
                    {
                        data: datosCantidad,
                        label: 'Cantidad (Unidades)',
                        type: 'line',
                        yAxisID: 'y1',
                        borderColor: 'rgba(255, 99, 132, 1)',
                        backgroundColor: 'rgba(255, 99, 132, 0.5)',
                        pointBackgroundColor: 'rgba(255, 99, 132, 1)',
                        pointRadius: 5,
                        tension: 0.4
                    }
                ]
            };
        });
    }
}
