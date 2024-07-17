import {ApplicationConfig, Injectable} from '@angular/core'
import {provideAnimationsAsync} from '@angular/platform-browser/animations/async'
import {provideHighlightOptions} from 'ngx-highlightjs'
import {MatPaginatorIntl} from '@angular/material/paginator'
import {MAT_FORM_FIELD_DEFAULT_OPTIONS} from '@angular/material/form-field'

@Injectable()
class LoggerMatPaginatorIntl extends MatPaginatorIntl {
  override itemsPerPageLabel = 'Queries per page:'

  override getRangeLabel = (page: number, pageSize: number, length: number) => {
    length = Math.max(length, 0)

    if (length === 0 || pageSize === 0) {
      return `0 of ${length}`
    }

    const startIndex = page * pageSize
    // If the start index exceeds the list length, do not try and fix the end index to the end.
    const endIndex = startIndex < length ? Math.min(startIndex + pageSize, length) : startIndex + pageSize
    return `${(startIndex + 1).toLocaleString()} – ${endIndex.toLocaleString()} of ${length.toLocaleString()}`
  }
}

export const appConfig: ApplicationConfig = {
  providers: [
    provideAnimationsAsync(),
    provideHighlightOptions({
      coreLibraryLoader: () => import('highlight.js/lib/core'),
      languages: {
        pgsql: () => import('highlight.js/lib/languages/pgsql'),
      },
    }),
    {provide: MatPaginatorIntl, useClass: LoggerMatPaginatorIntl},
    {
      provide: MAT_FORM_FIELD_DEFAULT_OPTIONS,
      useValue: {
        subscriptSizing: 'dynamic',
      },
    },
  ],
}
