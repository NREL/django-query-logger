import {Component, EventEmitter, Input, Output} from '@angular/core'
import {MatButtonModule} from '@angular/material/button'
import {MatIconModule} from '@angular/material/icon'
import sqlFormatter from '@sqltools/formatter'
import {Highlight} from 'ngx-highlightjs'
import {Query} from '../types'

@Component({
  selector: 'app-sidenav',
  standalone: true,
  imports: [Highlight, MatButtonModule, MatIconModule],
  templateUrl: './sidenav.component.html',
  styleUrl: './sidenav.component.scss',
})
export class SidenavComponent {
  @Output() closeEvent = new EventEmitter<void>()
  formattedQuery = ''

  @Input()
  set query(query: Query | undefined) {
    this.formattedQuery = sqlFormatter.format(query?.sql ?? '', {
      language: 'sql',
      reservedWordCase: 'upper',
    })
  }

  close() {
    this.closeEvent.emit()
  }
}
