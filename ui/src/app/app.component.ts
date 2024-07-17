import {COMMA, ENTER} from '@angular/cdk/keycodes'
import {DecimalPipe} from '@angular/common'
import {AfterViewInit, Component, OnDestroy, TrackByFunction, ViewChild} from '@angular/core'
import {FormsModule} from '@angular/forms'
import {MatButtonModule} from '@angular/material/button'
import {MatChipEditedEvent, MatChipInputEvent, MatChipsModule} from '@angular/material/chips'
import {MatDialog} from '@angular/material/dialog'
import {MatFormFieldModule} from '@angular/material/form-field'
import {MatIconModule} from '@angular/material/icon'
import {MatInputModule} from '@angular/material/input'
import {MatPaginator, MatPaginatorModule} from '@angular/material/paginator'
import {MatSidenavModule} from '@angular/material/sidenav'
import {MatSort, MatSortModule} from '@angular/material/sort'
import {MatTableDataSource, MatTableModule} from '@angular/material/table'
import {Highlight} from 'ngx-highlightjs'
import {Subscription} from 'rxjs'
import {ElapsedPipe} from './elapsed.pipe'
import {SidenavComponent} from './sidenav/sidenav.component'
import {StatsDialogComponent} from './stats-dialog/stats-dialog.component'
import {TimestampPipe} from './timestamp.pipe'
import {Query} from './types'
import {WebSocketService} from './web-socket.service'

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [
    DecimalPipe,
    ElapsedPipe,
    FormsModule,
    Highlight,
    MatButtonModule,
    MatChipsModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatPaginatorModule,
    MatSidenavModule,
    MatSortModule,
    MatTableModule,
    SidenavComponent,
    TimestampPipe,
  ],
  templateUrl: './app.component.html',
  styleUrl: './app.component.scss',
})
export class AppComponent implements AfterViewInit, OnDestroy {
  dataSource = new MatTableDataSource<Query>()
  displayedColumns = ['id', 'timestamp', 'duration', 'sql']
  elapsedTime = 0
  selectedQuery: Query | undefined
  sidenavOpened = false
  // Filters
  readonly separatorKeysCodes = [ENTER, COMMA] as const
  filterInclusivity = true
  filters: Set<string> = new Set()
  @ViewChild(MatPaginator) paginator: MatPaginator | undefined
  @ViewChild(MatSort) sort: MatSort | undefined
  private subscription: Subscription | undefined

  constructor(
    private dialog: MatDialog,
    private webSocketService: WebSocketService,
  ) {
    const memoizeLast = this.createMemoizedLast()
    this.dataSource.filterPredicate = (query, filter) => {
      const filters = memoizeLast(filter)
      if (this.filterInclusivity) {
        return filters.every(filter => query.sql.toLowerCase().includes(filter))
      } else {
        return !filters.some(filter => query.sql.toLowerCase().includes(filter))
      }
    }
  }

  trackById: TrackByFunction<Query> = (_index: number, {id}: Query): number => id

  ngAfterViewInit() {
    this.dataSource.paginator = this.paginator ?? null
    this.dataSource.sort = this.sort ?? null

    this.subscription = this.webSocketService.queries$.subscribe({
      next: (queries) => {
        this.dataSource.data = this.dataSource.data.concat(queries)
        this.updateElapsedTime()
      },
      error: (error) => console.error('Error in receiving messages:', error),
    })
  }

  ngOnDestroy() {
    this.subscription?.unsubscribe()
    this.webSocketService.close()
  }

  updateElapsedTime() {
    if (this.dataSource.filteredData.length > 1) {
      this.elapsedTime = this.dataSource.filteredData[this.dataSource.filteredData.length - 1].timestamp - this.dataSource.filteredData[0].timestamp
    } else {
      this.elapsedTime = 0
    }
  }

  stats() {
    this.dialog.open(StatsDialogComponent, {
      maxWidth: '80vw',
    })
  }

  download() {
    const jsonString = JSON.stringify(this.dataSource.filteredData, null, 2)
    const blob = new Blob([jsonString], {type: 'application/json'})
    const url = URL.createObjectURL(blob)

    const a = document.createElement('a')
    a.href = url
    a.download = 'queries.json'

    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)

    URL.revokeObjectURL(url)
  }

  clear() {
    this.sidenavOpened = false
    this.dataSource.data = []
    this.filters.clear()
    this.applyFilters()
    delete this.selectedQuery
    this.updateElapsedTime()
    this.webSocketService.sendMessage({action: 'clear'})
  }

  showSql(query: Query) {
    this.selectedQuery = query
    this.sidenavOpened = true
  }

  applyFilters() {
    this.dataSource.filter = this.filters.size ? [...this.filters].join('\0').toLowerCase() : ''
    this.updateElapsedTime()
    this.dataSource.paginator?.firstPage()
  }

  toggleFilterInclusivity() {
    this.filterInclusivity = !this.filterInclusivity
    this.applyFilters()
  }

  addFilter(event: MatChipInputEvent) {
    const newFilter = event.value.trim()

    if (newFilter) {
      this.filters.add(newFilter)
      this.applyFilters()
    }
    event.chipInput.clear()
  }

  editFilter(previousFilter: string, event: MatChipEditedEvent) {
    const newFilter = event.value.trim()

    if (newFilter !== previousFilter) {
      this.removeFilter(previousFilter)
      if (newFilter) this.filters.add(newFilter)
      this.applyFilters()
    }
  }

  removeFilter(filter: string) {
    this.filters.delete(filter)
    this.applyFilters()
  }

  private createMemoizedLast() {
    let lastInput: string | null = null
    let lastOutput: string[] | null = null

    return (input: string): string[] => {
      if (input === lastInput) {
        return lastOutput!
      }

      lastInput = input
      lastOutput = input.split('\0')
      return lastOutput
    }
  }
}
