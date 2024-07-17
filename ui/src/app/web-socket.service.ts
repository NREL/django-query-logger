import {Injectable} from '@angular/core'
import {Subject} from 'rxjs'
import {WebSocketSubject} from 'rxjs/webSocket'
import {retry} from 'rxjs/operators'
import {ActionMessage, Message, Queries, Stats, StatsProgress} from './types'

class TypedWebSocketSubject<Message, ActionMessage> extends WebSocketSubject<Message> {
  send(message: ActionMessage): void {
    this.next(message as any)
  }
}

@Injectable({
  providedIn: 'root',
})
export class WebSocketService {
  private readonly socket$: TypedWebSocketSubject<Message, ActionMessage>
  private queriesSubject$ = new Subject<Queries>()
  queries$ = this.queriesSubject$.asObservable()
  private statsSubject$ = new Subject<Stats>()
  stats$ = this.statsSubject$.asObservable()
  private statsProgressSubject$ = new Subject<StatsProgress>()
  statsProgress$ = this.statsProgressSubject$.asObservable()

  constructor() {
    this.socket$ = new TypedWebSocketSubject({url: 'ws://127.0.0.1:3000'})
    this.socket$.pipe(
      retry({delay: 1000}),
    ).subscribe(
      ({data, type}) => {
        switch (type) {
          case 'queries':
            this.queriesSubject$.next(data)
            break
          case 'stats':
            this.statsSubject$.next(data)
            break
          case 'stats-progress':
            this.statsProgressSubject$.next(data)
            break
        }
      },
    )
  }

  public sendMessage(msg: ActionMessage) {
    this.socket$.send(msg)
  }

  public close() {
    this.socket$.complete()
  }
}
