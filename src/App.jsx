import { useEffect, useMemo, useState } from 'react'
import universities from './data/universities.json'
import './App.css'

const UNKNOWN = '未确认'

const regionFilters = ['全国', '东京', '关东', '关西']
const typeFilters = ['全部', '国立', '公立', '私立']
const majorFilters = ['全部', '情报', '机械', '电气', '化学', '建筑']
const applicationStatuses = [
  '未确认',
  '准备中',
  '已出愿',
  '已考试',
  '合格',
  '不合格',
  '放弃',
]
const statusFilters = ['全部', ...applicationStatuses]

const majorKeywords = {
  情报: ['情报', '信息', '情報'],
  机械: ['机械', '機械'],
  电气: ['电气', '電氣', '電気', '电子', '電子'],
  化学: ['化学', '化學', '化工'],
  建筑: ['建筑', '建築'],
}

const detailFields = [
  ['basicInfo', '基本信息'],
  ['faculties', '可报考学部/学科'],
  ['ejuRequirements', 'EJU要求'],
  ['referenceEjuScore', '参考EJU分数'],
  ['englishRequirements', '英语要求'],
  ['internalExam', '校内考'],
  ['applicationMaterials', '申请材料'],
  ['notes', '备注'],
]

const timelineFields = [
  ['applicationStart', '出愿开始'],
  ['applicationDeadline', '出愿截止'],
  ['examDate', '考试日'],
  ['resultDate', '合格发表'],
]

const examTimelineFields = [
  ['applicationStart', '出愿开始'],
  ['applicationDeadline', '出愿截止'],
  ['examDate', '校内考 / 考试日'],
  ['resultDate', '合格发表'],
  ['enrollmentProcedureDeadline', '入学手续截止'],
]

const timeFilterFields = [
  ['applicationStart', '出愿开始时间'],
  ['applicationDeadline', '出愿截止时间'],
  ['examDate', '校内考/考试日'],
  ['resultDate', '合格发表日'],
]

const applicationTasks = [
  ['checkGuideline', '确认募集要项'],
  ['checkEjuSubjects', '确认EJU科目'],
  ['prepareGraduationCertificate', '准备毕业证明书'],
  ['prepareTranscript', '准备成绩证明书'],
  ['prepareEjuScore', '准备EJU成绩'],
  ['prepareEnglishScore', '准备英语成绩'],
  ['fillApplicationForm', '填写入学愿书'],
  ['writeStatement', '志望理由书'],
  ['payApplicationFee', '支付检定料'],
  ['mailDocuments', '邮寄材料'],
  ['checkExamTicket', '确认受验票'],
]

const fallbackTimelineStart = new Date(2026, 7, 1)
const fallbackTimelineEnd = new Date(2026, 11, 31)

const materialStatusLabels = {
  required: '必须',
  possible: '可能需要',
  unknown: '未确认',
  必须: '必须',
  可能需要: '可能需要',
  未确认: '未确认',
}

const favoritesStorageKey = 'eju-guide-favorite-university-ids'
const taskStorageKey = 'eju-guide-application-tasks'
const statusStorageKey = 'eju-guide-application-statuses'
const today = new Date('2026-06-03T00:00:00+09:00')

function getValue(value) {
  if (value === null || value === undefined || value === '') {
    return UNKNOWN
  }

  if (Array.isArray(value)) {
    return value.length > 0 ? value : UNKNOWN
  }

  return value
}

function isUrl(value) {
  if (typeof value !== 'string') {
    return false
  }

  try {
    const url = new URL(value)
    return url.protocol === 'http:' || url.protocol === 'https:'
  } catch {
    return false
  }
}

function formatFaculties(faculties) {
  if (!Array.isArray(faculties) || faculties.length === 0) {
    return UNKNOWN
  }

  return faculties
}

function getFacultyNames(faculties) {
  if (!Array.isArray(faculties) || faculties.length === 0) {
    return UNKNOWN
  }

  return faculties.map((faculty) => faculty.name).join('、')
}

function getMaterialStatus(status) {
  return materialStatusLabels[status] || UNKNOWN
}

function getMaterialClassName(status) {
  const normalizedStatus = getMaterialStatus(status)

  if (normalizedStatus === '必须') {
    return 'required'
  }

  if (normalizedStatus === '可能需要') {
    return 'possible'
  }

  return 'unknown'
}

function normalizeApplicationMaterials(materials) {
  if (!Array.isArray(materials)) {
    return []
  }

  return materials.map((material, index) => {
    const name =
      typeof material === 'string' ? material : material.name || `${UNKNOWN}${index}`
    const status =
      typeof material === 'string' ? UNKNOWN : getMaterialStatus(material.status)

    return { name, status }
  })
}

function getMaterialTaskId(materialName) {
  if (materialName.includes('毕业')) {
    return 'prepareGraduationCertificate'
  }

  if (materialName.includes('成绩') && !materialName.includes('EJU')) {
    return 'prepareTranscript'
  }

  if (materialName.includes('EJU')) {
    return 'prepareEjuScore'
  }

  if (materialName.includes('英语')) {
    return 'prepareEnglishScore'
  }

  if (materialName.includes('入学愿书')) {
    return 'fillApplicationForm'
  }

  if (materialName.includes('志望理由')) {
    return 'writeStatement'
  }

  if (materialName.includes('检定料') || materialName.includes('検定料')) {
    return 'payApplicationFee'
  }

  return 'mailDocuments'
}

function getMaterialGaps(university, completedTaskIds) {
  const completedTasks = Array.isArray(completedTaskIds) ? completedTaskIds : []

  return normalizeApplicationMaterials(university.applicationMaterials).filter(
    (material) => !completedTasks.includes(getMaterialTaskId(material.name)),
  )
}

function getTimelineValue(university, key) {
  return getValue(
    university.admissionTimeline?.[key] ||
      university.timeline?.[key] ||
      university[key],
  )
}

function parseDate(value) {
  if (typeof value !== 'string' || value === UNKNOWN) {
    return null
  }

  const normalizedValue = value.replaceAll('/', '-')
  const match = normalizedValue.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/)

  if (!match) {
    return null
  }

  const [, year, month, day] = match
  const date = new Date(
    Number(year),
    Number(month) - 1,
    Number(day),
    0,
    0,
    0,
  )

  return Number.isNaN(date.getTime()) ? null : date
}

function getDaysUntil(date) {
  return Math.ceil((date.getTime() - today.getTime()) / 86400000)
}

function getTimelineStatus(key, value) {
  const date = parseDate(value)

  if (!date) {
    return null
  }

  const daysUntil = getDaysUntil(date)

  if (daysUntil < 0) {
    return '已结束'
  }

  if (key === 'applicationDeadline' && daysUntil <= 30) {
    return '即将截止'
  }

  return null
}

function getTaskProgress(taskState, universityId) {
  const completedTasks = Array.isArray(taskState[universityId])
    ? taskState[universityId]
    : []

  return {
    completed: completedTasks.length,
    total: applicationTasks.length,
  }
}

function getApplicationStatus(statusState, universityId) {
  const status = statusState[universityId]

  return applicationStatuses.includes(status) ? status : UNKNOWN
}

function getStatusClassName(status) {
  const statusClassNames = {
    未确认: 'unknown',
    准备中: 'preparing',
    已出愿: 'applied',
    已考试: 'examined',
    合格: 'passed',
    不合格: 'failed',
    放弃: 'withdrawn',
  }

  return statusClassNames[status] || 'unknown'
}

function getTimelineNodeClass(key) {
  const classNames = {
    applicationStart: 'start',
    applicationDeadline: 'deadline',
    examDate: 'exam',
    resultDate: 'result',
    enrollmentProcedureDeadline: 'enrollment',
  }

  return classNames[key] || 'start'
}

function createEmptyTimeFilters() {
  return Object.fromEntries(
    timeFilterFields.map(([key]) => [
      key,
      {
        end: '',
        start: '',
      },
    ]),
  )
}

function hasActiveTimeFilters(timeFilters) {
  return timeFilterFields.some(
    ([key]) => timeFilters[key]?.start || timeFilters[key]?.end,
  )
}

function matchesTimeFilters(university, timeFilters) {
  return timeFilterFields.every(([key]) => {
    const filter = timeFilters[key]

    if (!filter?.start && !filter?.end) {
      return true
    }

    const universityDate = parseDate(getTimelineValue(university, key))

    if (!universityDate) {
      return false
    }

    const startDate = filter.start ? parseDate(filter.start) : null
    const endDate = filter.end ? parseDate(filter.end) : null

    if (startDate && universityDate < startDate) {
      return false
    }

    if (endDate && universityDate > endDate) {
      return false
    }

    return true
  })
}

function getUniversitySortDate(university) {
  const applicationStart = parseDate(getTimelineValue(university, 'applicationStart'))

  return applicationStart
    ? applicationStart.getTime()
    : Number.POSITIVE_INFINITY
}

function getKnownTimelineDates(universitiesToRead) {
  return universitiesToRead
    .flatMap((university) =>
      examTimelineFields.map(([key]) => parseDate(getTimelineValue(university, key))),
    )
    .filter(Boolean)
}

function getTimelineChartRange(universitiesToRead) {
  const dates = getKnownTimelineDates(universitiesToRead)

  if (dates.length === 0) {
    return {
      end: fallbackTimelineEnd,
      start: fallbackTimelineStart,
    }
  }

  const earliestDate = new Date(Math.min(...dates.map((date) => date.getTime())))
  const latestDate = new Date(Math.max(...dates.map((date) => date.getTime())))
  const start = new Date(
    earliestDate.getFullYear(),
    earliestDate.getMonth(),
    1,
  )
  const end = new Date(latestDate.getFullYear(), latestDate.getMonth() + 1, 0)

  return {
    end: end < fallbackTimelineEnd ? fallbackTimelineEnd : end,
    start: start > fallbackTimelineStart ? fallbackTimelineStart : start,
  }
}

function getMonthTicks(start, end) {
  const ticks = []
  const current = new Date(start.getFullYear(), start.getMonth(), 1)

  while (current <= end) {
    ticks.push(new Date(current))
    current.setMonth(current.getMonth() + 1)
  }

  return ticks
}

function getTimelinePosition(date, start, end) {
  const duration = end.getTime() - start.getTime()

  if (!date || duration <= 0) {
    return 0
  }

  return Math.min(
    100,
    Math.max(0, ((date.getTime() - start.getTime()) / duration) * 100),
  )
}

function formatMonthTick(date) {
  return `${date.getFullYear()}年${date.getMonth() + 1}月`
}

function createSearchText(university) {
  const facultyText = university.faculties
    ?.flatMap((faculty) => [faculty.name, ...(faculty.departments || [])])
    .join(' ')

  return [
    university.name,
    university.region,
    university.type,
    university.referenceEjuScore,
    facultyText,
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase()
}

function matchesRegion(university, regionFilter) {
  const region = university.region || ''

  if (regionFilter === '全国') {
    return true
  }

  if (regionFilter === '东京') {
    return region.includes('东京') || region.includes('東京都')
  }

  if (regionFilter === '关西') {
    return region.includes('关西') || region.includes('近畿')
  }

  return region.includes(regionFilter)
}

function matchesMajor(university, majorFilter) {
  if (majorFilter === '全部') {
    return true
  }

  const keywords = majorKeywords[majorFilter] || [majorFilter]
  return keywords.some((keyword) => createSearchText(university).includes(keyword))
}

function App() {
  const [activePage, setActivePage] = useState('list')
  const [query, setQuery] = useState('')
  const [regionFilter, setRegionFilter] = useState('全国')
  const [typeFilter, setTypeFilter] = useState('全部')
  const [majorFilter, setMajorFilter] = useState('全部')
  const [statusFilter, setStatusFilter] = useState('全部')
  const [favoriteIds, setFavoriteIds] = useState(() => {
    try {
      const savedIds = JSON.parse(
        localStorage.getItem(favoritesStorageKey) || '[]',
      )
      return Array.isArray(savedIds) ? savedIds : []
    } catch {
      return []
    }
  })
  const [taskState, setTaskState] = useState(() => {
    try {
      const savedTasks = JSON.parse(localStorage.getItem(taskStorageKey) || '{}')
      return savedTasks && typeof savedTasks === 'object' ? savedTasks : {}
    } catch {
      return {}
    }
  })
  const [statusState, setStatusState] = useState(() => {
    try {
      const savedStatuses = JSON.parse(
        localStorage.getItem(statusStorageKey) || '{}',
      )
      return savedStatuses && typeof savedStatuses === 'object'
        ? savedStatuses
        : {}
    } catch {
      return {}
    }
  })
  const [selectedId, setSelectedId] = useState(() =>
    window.location.hash.replace('#', ''),
  )

  useEffect(() => {
    const handleHashChange = () => {
      setSelectedId(window.location.hash.replace('#', ''))
      window.scrollTo({ top: 0, behavior: 'smooth' })
    }

    window.addEventListener('hashchange', handleHashChange)
    return () => window.removeEventListener('hashchange', handleHashChange)
  }, [])

  useEffect(() => {
    localStorage.setItem(favoritesStorageKey, JSON.stringify(favoriteIds))
  }, [favoriteIds])

  useEffect(() => {
    localStorage.setItem(taskStorageKey, JSON.stringify(taskState))
  }, [taskState])

  useEffect(() => {
    localStorage.setItem(statusStorageKey, JSON.stringify(statusState))
  }, [statusState])

  const selectedUniversity = universities.find(
    (university) => university.id === selectedId,
  )
  const favoriteUniversities = favoriteIds
    .map((id) => universities.find((university) => university.id === id))
    .filter(Boolean)

  const filteredUniversities = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase()

    return universities.filter((university) =>
      (!normalizedQuery ||
        createSearchText(university).includes(normalizedQuery)) &&
      matchesRegion(university, regionFilter) &&
      (typeFilter === '全部' || university.type === typeFilter) &&
      matchesMajor(university, majorFilter) &&
      (statusFilter === '全部' ||
        getApplicationStatus(statusState, university.id) === statusFilter),
    )
  }, [majorFilter, query, regionFilter, statusFilter, statusState, typeFilter])

  const openUniversity = (id) => {
    window.location.hash = id
  }

  const closeDetail = () => {
    window.history.pushState('', document.title, window.location.pathname)
    setSelectedId('')
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const switchPage = (page) => {
    setActivePage(page)

    if (selectedId) {
      window.history.pushState('', document.title, window.location.pathname)
      setSelectedId('')
    }

    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const toggleFavorite = (id) => {
    setFavoriteIds((currentIds) => {
      if (currentIds.includes(id)) {
        return currentIds.filter((currentId) => currentId !== id)
      }

      return [...currentIds, id]
    })
  }

  const clearFavorites = () => {
    setFavoriteIds([])
  }

  const toggleTask = (universityId, taskId) => {
    setTaskState((currentState) => {
      const completedTasks = Array.isArray(currentState[universityId])
        ? currentState[universityId]
        : []
      const nextCompletedTasks = completedTasks.includes(taskId)
        ? completedTasks.filter((currentTaskId) => currentTaskId !== taskId)
        : [...completedTasks, taskId]

      return {
        ...currentState,
        [universityId]: nextCompletedTasks,
      }
    })
  }

  const updateApplicationStatus = (universityId, status) => {
    setStatusState((currentState) => ({
      ...currentState,
      [universityId]: applicationStatuses.includes(status) ? status : UNKNOWN,
    }))
  }

  return (
    <main className="app-shell">
      <header className="topbar">
        <div>
          <p className="eyebrow">EJU University Guide</p>
          <h1>日本理工科大学报考信息查询</h1>
          <p className="subtitle">
            先用第一版把学校、学部、EJU、英语、校内考和时间节点集中管理起来。
          </p>
        </div>
      </header>

      <nav className="page-nav" aria-label="页面导航">
        <button
          className={activePage === 'list' ? 'active' : undefined}
          type="button"
          aria-pressed={activePage === 'list'}
          onClick={() => switchPage('list')}
        >
          大学列表
        </button>
        <button
          className={activePage === 'timeline' ? 'active' : undefined}
          type="button"
          aria-pressed={activePage === 'timeline'}
          onClick={() => switchPage('timeline')}
        >
          报考时间线
        </button>
      </nav>

      {selectedUniversity ? (
        <UniversityDetail
          applicationStatus={getApplicationStatus(statusState, selectedUniversity.id)}
          taskState={taskState}
          university={selectedUniversity}
          onBack={closeDetail}
          onToggleTask={toggleTask}
          onUpdateStatus={updateApplicationStatus}
        />
      ) : activePage === 'timeline' ? (
        <TimelinePage
          favoriteUniversities={favoriteUniversities}
          onOpenUniversity={openUniversity}
          universities={universities}
        />
      ) : (
        <UniversityList
          favoriteIds={favoriteIds}
          favoriteUniversities={favoriteUniversities}
          filters={{ majorFilter, regionFilter, statusFilter, typeFilter }}
          query={query}
          statusState={statusState}
          taskState={taskState}
          universities={filteredUniversities}
          onClearFavorites={clearFavorites}
          onFilterChange={{
            setMajorFilter,
            setRegionFilter,
            setStatusFilter,
            setTypeFilter,
          }}
          onToggleFavorite={toggleFavorite}
          onQueryChange={setQuery}
          onOpenUniversity={openUniversity}
        />
      )}
    </main>
  )
}

function UniversityList({
  favoriteIds,
  favoriteUniversities,
  filters,
  query,
  statusState,
  taskState,
  universities: filteredUniversities,
  onClearFavorites,
  onFilterChange,
  onQueryChange,
  onOpenUniversity,
  onToggleFavorite,
}) {
  const [isFilterOpen, setIsFilterOpen] = useState(false)
  const hasActiveFilters =
    filters.regionFilter !== '全国' ||
    filters.typeFilter !== '全部' ||
    filters.majorFilter !== '全部' ||
    filters.statusFilter !== '全部'

  const clearFilters = () => {
    onFilterChange.setRegionFilter('全国')
    onFilterChange.setTypeFilter('全部')
    onFilterChange.setMajorFilter('全部')
    onFilterChange.setStatusFilter('全部')
  }

  return (
    <>
      <section className="search-panel" aria-label="大学搜索">
        <label htmlFor="university-search">搜索大学名、地区、专业</label>
        <div className="search-row">
          <input
            id="university-search"
            type="search"
            value={query}
            onChange={(event) => onQueryChange(event.target.value)}
            placeholder="例如：东京、工学、信息、私立"
          />
          <span>{filteredUniversities.length} 所大学</span>
        </div>

        <div className="filter-toggle-row">
          <button
            className="filter-toggle-button"
            type="button"
            aria-expanded={isFilterOpen}
            aria-controls="filter-groups"
            onClick={() => setIsFilterOpen((currentValue) => !currentValue)}
          >
            筛选条件
          </button>
          <span>{isFilterOpen ? '收起筛选' : '展开筛选'}</span>
          {hasActiveFilters ? <strong>已筛选</strong> : null}
          <button
            className="clear-filters-button"
            type="button"
            disabled={!hasActiveFilters}
            onClick={clearFilters}
          >
            清除筛选
          </button>
        </div>

        {isFilterOpen ? (
          <div className="filter-groups" id="filter-groups" aria-label="筛选条件">
            <FilterGroup
              label="地区"
              options={regionFilters}
              selected={filters.regionFilter}
              onSelect={onFilterChange.setRegionFilter}
            />
            <FilterGroup
              label="大学类型"
              options={typeFilters}
              selected={filters.typeFilter}
              onSelect={onFilterChange.setTypeFilter}
            />
            <FilterGroup
              label="专业方向"
              options={majorFilters}
              selected={filters.majorFilter}
              onSelect={onFilterChange.setMajorFilter}
            />
            <FilterGroup
              label="报考状态"
              options={statusFilters}
              selected={filters.statusFilter}
              onSelect={onFilterChange.setStatusFilter}
            />
          </div>
        ) : null}
      </section>

      <FavoritePanel
        favoriteUniversities={favoriteUniversities}
        onClearFavorites={onClearFavorites}
        onOpenUniversity={onOpenUniversity}
        onToggleFavorite={onToggleFavorite}
      />

      <section className="university-grid" aria-label="大学列表">
        {filteredUniversities.length > 0 ? (
          filteredUniversities.map((university) => {
            const isFavorite = favoriteIds.includes(university.id)
            const completedTaskIds = Array.isArray(taskState[university.id])
              ? taskState[university.id]
              : []
            const taskProgress = getTaskProgress(taskState, university.id)
            const applicationStatus = getApplicationStatus(
              statusState,
              university.id,
            )
            const materialGapCount = getMaterialGaps(
              university,
              completedTaskIds,
            ).length

            return (
              <article className="university-card" key={university.id}>
                <button
                  className="card-main"
                  type="button"
                  onClick={() => onOpenUniversity(university.id)}
                >
                  <div className="card-header">
                    <div>
                      <h2>{university.name}</h2>
                      <p>{getValue(university.region)}</p>
                    </div>
                    <span className="type-badge">
                      {getValue(university.type)}
                    </span>
                  </div>
                  <StatusBadge status={applicationStatus} />

                  <dl className="card-facts">
                    <div>
                      <dt>可报考学部</dt>
                      <dd>{getFacultyNames(university.faculties)}</dd>
                    </div>
                    <div>
                      <dt>参考EJU分数</dt>
                      <dd>{getValue(university.referenceEjuScore)}</dd>
                    </div>
                    <div>
                      <dt>任务进度</dt>
                      <dd>
                        {taskProgress.completed}/{taskProgress.total}
                      </dd>
                    </div>
                    <div>
                      <dt>材料缺口</dt>
                      <dd>
                        {materialGapCount === 0
                          ? '准备完成'
                          : `还差 ${materialGapCount} 项`}
                      </dd>
                    </div>
                  </dl>
                </button>

                <button
                  className={
                    isFavorite ? 'favorite-button active' : 'favorite-button'
                  }
                  type="button"
                  aria-pressed={isFavorite}
                  onClick={() => onToggleFavorite(university.id)}
                >
                  {isFavorite ? '已收藏' : '收藏'}
                </button>
              </article>
            )
          })
        ) : (
          <div className="empty-state">
            <h2>没有找到匹配的大学</h2>
            <p>可以换一个大学名、地区或专业关键词试试。</p>
          </div>
        )}
      </section>
    </>
  )
}

function TimelinePage({ favoriteUniversities, onOpenUniversity, universities }) {
  return (
    <div className="timeline-page">
      <ExamTimeline
        favoriteUniversities={favoriteUniversities}
        onOpenUniversity={onOpenUniversity}
        universities={universities}
      />
    </div>
  )
}

function ExamTimeline({
  favoriteUniversities,
  onOpenUniversity,
  universities: allUniversities,
}) {
  const [isTimeFilterOpen, setIsTimeFilterOpen] = useState(true)
  const [timeFilters, setTimeFilters] = useState(() => createEmptyTimeFilters())
  const [displayMode, setDisplayMode] = useState('all')
  const [customUniversityIds, setCustomUniversityIds] = useState([])
  const [customUniversityQuery, setCustomUniversityQuery] = useState('')
  const hasFavorites = favoriteUniversities.length > 0
  const filteredCustomUniversities = allUniversities.filter((university) =>
    [university.name, university.region, university.type]
      .filter(Boolean)
      .join(' ')
      .toLowerCase()
      .includes(customUniversityQuery.trim().toLowerCase()),
  )
  const visibleUniversities =
    displayMode === 'favorites' && hasFavorites
      ? favoriteUniversities
      : displayMode === 'custom'
        ? customUniversityIds
            .map((id) => allUniversities.find((university) => university.id === id))
            .filter(Boolean)
        : allUniversities
  const hasTimeFilters = hasActiveTimeFilters(timeFilters)
  const filteredTimelineUniversities = hasTimeFilters
    ? visibleUniversities.filter((university) =>
        matchesTimeFilters(university, timeFilters),
      )
    : visibleUniversities
  const chartRange = getTimelineChartRange(filteredTimelineUniversities)
  const monthTicks = getMonthTicks(chartRange.start, chartRange.end)
  const sortedUniversities = [...filteredTimelineUniversities].sort((a, b) => {
    const dateDifference = getUniversitySortDate(a) - getUniversitySortDate(b)

    if (dateDifference !== 0) {
      return dateDifference
    }

    return a.name.localeCompare(b.name, 'zh-Hans-CN')
  })
  const updateTimeFilter = (key, field, value) => {
    setTimeFilters((currentFilters) => ({
      ...currentFilters,
      [key]: {
        ...currentFilters[key],
        [field]: value,
      },
    }))
  }
  const clearTimeFilters = () => {
    setTimeFilters(createEmptyTimeFilters())
  }
  const hasKnownTimelineData =
    getKnownTimelineDates(filteredTimelineUniversities).length > 0
  const toggleCustomUniversity = (id) => {
    setCustomUniversityIds((currentIds) =>
      currentIds.includes(id)
        ? currentIds.filter((currentId) => currentId !== id)
        : [...currentIds, id],
    )
  }
  const selectAllCustomUniversities = () => {
    setCustomUniversityIds((currentIds) => [
      ...new Set([
        ...currentIds,
        ...filteredCustomUniversities.map((university) => university.id),
      ]),
    ])
  }
  const clearCustomUniversities = () => {
    setCustomUniversityIds([])
  }

  return (
    <section className="exam-timeline-section" aria-label="报考时间线">
      <div className="section-heading">
        <div>
          <h2>报考时间线</h2>
          <p>把不同大学的出愿、考试和手续时间放在一起看</p>
        </div>
        <div className="timeline-scope-switch" aria-label="显示大学模式">
          <button
            className={displayMode === 'all' ? 'active' : undefined}
            type="button"
            aria-pressed={displayMode === 'all'}
            onClick={() => setDisplayMode('all')}
          >
            全部大学
          </button>
          <button
            className={displayMode === 'favorites' ? 'active' : undefined}
            type="button"
            aria-pressed={displayMode === 'favorites'}
            disabled={!hasFavorites}
            onClick={() => setDisplayMode('favorites')}
          >
            只看我的候选大学
          </button>
          <button
            className={displayMode === 'custom' ? 'active' : undefined}
            type="button"
            aria-pressed={displayMode === 'custom'}
            onClick={() => setDisplayMode('custom')}
          >
            自定义选择大学
          </button>
        </div>
      </div>

      {displayMode === 'custom' ? (
        <div className="timeline-university-picker" aria-label="自定义选择大学">
          <div className="timeline-picker-actions">
            <strong>显示大学</strong>
            <input
              aria-label="搜索自定义大学"
              className="timeline-picker-search"
              type="search"
              value={customUniversityQuery}
              onChange={(event) => setCustomUniversityQuery(event.target.value)}
              placeholder="搜索大学名"
            />
            <button type="button" onClick={selectAllCustomUniversities}>
              全选
            </button>
            <button type="button" onClick={clearCustomUniversities}>
              清空选择
            </button>
            <span>已选择 {customUniversityIds.length} 所</span>
          </div>
          <div className="timeline-picker-grid">
            {filteredCustomUniversities.length > 0 ? (
              filteredCustomUniversities.map((university) => (
                <label key={university.id}>
                  <input
                    type="checkbox"
                    checked={customUniversityIds.includes(university.id)}
                    onChange={() => toggleCustomUniversity(university.id)}
                  />
                  <span>{university.name}</span>
                </label>
              ))
            ) : (
              <p className="timeline-picker-empty">没有找到匹配的大学</p>
            )}
          </div>
        </div>
      ) : null}

      <div className="time-filter-panel">
        <div className="time-filter-header">
          <div>
            <h3>时间筛选</h3>
            <p>符合条件：{sortedUniversities.length}所大学</p>
          </div>
          <div className="time-filter-actions">
            {hasTimeFilters ? <span>已筛选</span> : null}
            <button
              className="time-filter-toggle"
              type="button"
              aria-expanded={isTimeFilterOpen}
              aria-controls="time-filter-fields"
              onClick={() => setIsTimeFilterOpen((currentValue) => !currentValue)}
            >
              {isTimeFilterOpen ? '收起时间筛选' : '展开时间筛选'}
            </button>
            <button
              className="clear-time-filters-button"
              type="button"
              disabled={!hasTimeFilters}
              onClick={clearTimeFilters}
            >
              清除时间筛选
            </button>
          </div>
        </div>

        {isTimeFilterOpen ? (
          <div
            className="time-filter-grid"
            id="time-filter-fields"
            aria-label="时间筛选条件"
          >
            {timeFilterFields.map(([key, label]) => (
              <fieldset className="time-filter-field" key={key}>
                <legend>{label}</legend>
                <div className="time-filter-inputs">
                  <label>
                    <span>开始日期</span>
                    <input
                      type="date"
                      value={timeFilters[key].start}
                      onInput={(event) =>
                        updateTimeFilter(key, 'start', event.currentTarget.value)
                      }
                      onChange={(event) =>
                        updateTimeFilter(key, 'start', event.target.value)
                      }
                    />
                  </label>
                  <label>
                    <span>结束日期</span>
                    <input
                      type="date"
                      value={timeFilters[key].end}
                      onInput={(event) =>
                        updateTimeFilter(key, 'end', event.currentTarget.value)
                      }
                      onChange={(event) =>
                        updateTimeFilter(key, 'end', event.target.value)
                      }
                    />
                  </label>
                </div>
              </fieldset>
            ))}
          </div>
        ) : null}
      </div>

      {displayMode === 'custom' && customUniversityIds.length === 0 ? (
        <div className="timeline-empty-state">
          请选择大学或切换为全部大学
        </div>
      ) : sortedUniversities.length > 0 ? (
        <div className="timeline-chart-scroll">
          <div className="timeline-chart">
            {!hasKnownTimelineData ? (
              <div className="timeline-data-notice">暂无可显示的时间数据</div>
            ) : null}
            <div className="timeline-chart-header">
              <div className="timeline-chart-label">大学</div>
              <div className="timeline-axis">
                {monthTicks.map((date) => (
                  <span
                    key={`${date.getFullYear()}-${date.getMonth()}`}
                    style={{
                      left: `${getTimelinePosition(
                        date,
                        chartRange.start,
                        chartRange.end,
                      )}%`,
                    }}
                  >
                    {formatMonthTick(date)}
                  </span>
                ))}
              </div>
            </div>

            <div className="timeline-chart-body">
              {sortedUniversities.map((university) => {
                const events = examTimelineFields.map(([key, label]) => {
                  const value = getTimelineValue(university, key)
                  const date = parseDate(value)

                  return {
                    date,
                    key,
                    label,
                    status: getTimelineStatus(key, value),
                    value,
                  }
                })
                const knownEvents = events.filter((event) => event.date)
                const hasAnyKnownDate = knownEvents.length > 0
                const hasUnknownDates = knownEvents.length < events.length
                const applicationStart = knownEvents.find(
                  (event) => event.key === 'applicationStart',
                )
                const applicationDeadline = knownEvents.find(
                  (event) => event.key === 'applicationDeadline',
                )
                const periodStart = applicationStart
                  ? getTimelinePosition(
                      applicationStart.date,
                      chartRange.start,
                      chartRange.end,
                    )
                  : null
                const periodEnd = applicationDeadline
                  ? getTimelinePosition(
                      applicationDeadline.date,
                      chartRange.start,
                      chartRange.end,
                    )
                  : null

                return (
                  <article className="timeline-chart-row" key={university.id}>
                    <button
                      className="exam-timeline-title"
                      type="button"
                      onClick={() => onOpenUniversity(university.id)}
                    >
                      <strong>{university.name}</strong>
                      <span>
                        {getValue(university.region)} · {getValue(university.type)}
                      </span>
                    </button>

                    <div className="timeline-track">
                      {periodStart !== null && periodEnd !== null ? (
                        <div
                          className="application-period"
                          style={{
                            left: `${Math.min(periodStart, periodEnd)}%`,
                            width: `${Math.max(Math.abs(periodEnd - periodStart), 1.2)}%`,
                          }}
                        />
                      ) : null}

                      {monthTicks.map((date) => (
                        <span
                          className="timeline-grid-line"
                          key={`${university.id}-${date.getFullYear()}-${date.getMonth()}`}
                          style={{
                            left: `${getTimelinePosition(
                              date,
                              chartRange.start,
                              chartRange.end,
                            )}%`,
                          }}
                        />
                      ))}

                      {knownEvents.map((event) => (
                        <div
                          className={`timeline-node ${getTimelineNodeClass(
                            event.key,
                          )}`}
                          key={`${university.id}-${event.key}`}
                          style={{
                            left: `${getTimelinePosition(
                              event.date,
                              chartRange.start,
                              chartRange.end,
                            )}%`,
                          }}
                          title={`${event.label}：${event.value}`}
                          aria-label={`${university.name} ${event.label} ${event.value}`}
                          data-tooltip={`${university.name}｜${event.label}｜${event.value}`}
                        >
                          <span>{event.label}</span>
                          <strong>{event.value}</strong>
                          {event.status ? <em>{event.status}</em> : null}
                        </div>
                      ))}

                      {!hasAnyKnownDate ? (
                        <div className="timeline-unknown-note">
                          时间未确认
                        </div>
                      ) : hasUnknownDates ? (
                        <div className="timeline-unknown-note">
                          部分日期未确认
                        </div>
                      ) : null}
                    </div>
                  </article>
                )
              })}
            </div>
          </div>
        </div>
      ) : (
        <div className="timeline-empty-state">
          没有符合条件的大学，请调整筛选条件
        </div>
      )}
    </section>
  )
}

function FavoritePanel({
  favoriteUniversities,
  onClearFavorites,
  onOpenUniversity,
  onToggleFavorite,
}) {
  return (
    <section className="favorite-panel" aria-label="我的候选大学">
      <div>
        <h2>我的候选大学</h2>
        <p>当前收藏了 {favoriteUniversities.length} 所大学</p>
      </div>
      <div className="favorite-actions">
        <button
          className="clear-favorites-button"
          type="button"
          disabled={favoriteUniversities.length === 0}
          onClick={onClearFavorites}
        >
          清空收藏
        </button>
      </div>

      {favoriteUniversities.length > 0 ? (
        <div className="favorite-list">
          {favoriteUniversities.map((university) => (
            <article className="favorite-card" key={university.id}>
              <button
                className="favorite-card-main"
                type="button"
                onClick={() => onOpenUniversity(university.id)}
              >
                <strong>{university.name}</strong>
                <span>
                  {getValue(university.region)} · {getValue(university.type)}
                </span>
              </button>
              <button
                className="favorite-remove-button"
                type="button"
                onClick={() => onToggleFavorite(university.id)}
              >
                取消
              </button>
            </article>
          ))}
        </div>
      ) : (
        <p className="favorite-empty">还没有收藏大学，可以先把感兴趣的学校加入候选。</p>
      )}
    </section>
  )
}

function FilterGroup({ label, options, selected, onSelect }) {
  return (
    <fieldset className="filter-group">
      <legend>{label}</legend>
      <div className="filter-options">
        {options.map((option) => (
          <button
            className={option === selected ? 'filter-chip active' : 'filter-chip'}
            key={option}
            type="button"
            aria-pressed={option === selected}
            onClick={() => onSelect(option)}
          >
            {option}
          </button>
        ))}
      </div>
    </fieldset>
  )
}

function UniversityDetail({
  applicationStatus,
  taskState,
  university,
  onBack,
  onToggleTask,
  onUpdateStatus,
}) {
  return (
    <section className="detail-page" aria-label={`${university.name}详情`}>
      <button className="back-button" type="button" onClick={onBack}>
        返回列表
      </button>

      <div className="detail-hero">
        <div>
          <p className="eyebrow">{getValue(university.region)}</p>
          <h2>{university.name}</h2>
          <p>{getValue(university.basicInfo)}</p>
        </div>
        <span className="type-badge large">{getValue(university.type)}</span>
      </div>

      <ApplicationStatusPanel
        status={applicationStatus}
        university={university}
        onUpdateStatus={onUpdateStatus}
      />

      <ApplicationTimeline university={university} />

      <ApplicationTaskChecklist
        completedTaskIds={
          Array.isArray(taskState[university.id]) ? taskState[university.id] : []
        }
        university={university}
        onToggleTask={onToggleTask}
      />

      <MaterialGapReminder
        completedTaskIds={
          Array.isArray(taskState[university.id]) ? taskState[university.id] : []
        }
        university={university}
      />

      <GuidelineLinks university={university} />

      <div className="detail-grid">
        {detailFields.map(([key, label]) => (
          <DetailItem
            key={key}
            label={label}
            value={
              key === 'faculties'
                ? formatFaculties(university.faculties)
                : getValue(university[key])
            }
            fieldKey={key}
            isPdf={key === 'pdfUrl'}
          />
        ))}
      </div>
    </section>
  )
}

function StatusBadge({ status }) {
  return (
    <span className={`status-badge ${getStatusClassName(status)}`}>
      {status}
    </span>
  )
}

function ApplicationStatusPanel({ status, university, onUpdateStatus }) {
  return (
    <section className="status-section" aria-label="报考状态">
      <div className="section-heading">
        <div>
          <h2>报考状态</h2>
          <p>给这所大学标记当前进度，方便在首页筛选。</p>
        </div>
        <StatusBadge status={status} />
      </div>

      <div className="status-options">
        {applicationStatuses.map((option) => (
          <button
            className={option === status ? 'status-option active' : 'status-option'}
            key={option}
            type="button"
            aria-pressed={option === status}
            onClick={() => onUpdateStatus(university.id, option)}
          >
            {option}
          </button>
        ))}
      </div>
    </section>
  )
}

function ApplicationTaskChecklist({
  completedTaskIds,
  university,
  onToggleTask,
}) {
  const completedCount = completedTaskIds.length

  return (
    <section className="task-section" aria-label="报考任务清单">
      <div className="section-heading">
        <div>
          <h2>报考任务清单</h2>
          <p>
            已完成 {completedCount}/{applicationTasks.length}
          </p>
        </div>
      </div>

      <div className="task-list">
        {applicationTasks.map(([taskId, label]) => {
          const isCompleted = completedTaskIds.includes(taskId)

          return (
            <label
              className={isCompleted ? 'task-item completed' : 'task-item'}
              key={taskId}
            >
              <input
                type="checkbox"
                checked={isCompleted}
                onChange={() => onToggleTask(university.id, taskId)}
              />
              <span>{label}</span>
            </label>
          )
        })}
      </div>
    </section>
  )
}

function MaterialGapReminder({ completedTaskIds, university }) {
  const materialGaps = getMaterialGaps(university, completedTaskIds)

  return (
    <section className="material-gap-section" aria-label="未完成材料">
      <div className="section-heading">
        <div>
          <h2>未完成材料</h2>
          <p>
            {materialGaps.length === 0
              ? '材料准备完成'
              : `还差 ${materialGaps.length} 项材料`}
          </p>
        </div>
      </div>

      {materialGaps.length === 0 ? (
        <p className="material-gap-complete">材料准备完成</p>
      ) : (
        <div className="material-gap-list">
          {materialGaps.map((material, index) => (
            <div
              className={`material-gap-item ${getMaterialClassName(
                material.status,
              )}`}
              key={`${material.name}-${index}`}
            >
              <span>{material.status}</span>
              <strong>{material.name}</strong>
            </div>
          ))}
        </div>
      )}
    </section>
  )
}

function GuidelineLinks({ university }) {
  const guidelineUrl = getValue(university.guidelineUrl || university.pdfUrl)
  const officialPageUrl = getValue(university.officialPageUrl)
  const lastChecked = getValue(university.lastChecked)
  const guidelineStatus = getValue(university.guidelineStatus)
  const hasGuidelineUrl = isUrl(guidelineUrl)
  const hasOfficialPageUrl = isUrl(officialPageUrl)
  const hasAnyUrl = hasGuidelineUrl || hasOfficialPageUrl

  return (
    <section className="guideline-section" aria-label="募集要项・官方链接">
      <div className="section-heading">
        <div>
          <h2>募集要项・官方链接</h2>
          <p>用于集中确认官方 PDF、入试页面和核对状态。</p>
        </div>
        <span className={`guideline-status ${getGuidelineStatusClass(guidelineStatus)}`}>
          {guidelineStatus}
        </span>
      </div>

      <div className="guideline-content">
        <div className="guideline-actions">
          {hasGuidelineUrl ? (
            <a
              className="guideline-button primary"
              href={guidelineUrl}
              target="_blank"
              rel="noreferrer"
            >
              打开募集要项PDF
            </a>
          ) : null}

          {hasOfficialPageUrl ? (
            <a
              className="guideline-button"
              href={officialPageUrl}
              target="_blank"
              rel="noreferrer"
            >
              打开官方入试页面
            </a>
          ) : null}

          {!hasAnyUrl ? (
            <p className="guideline-empty">还没有确认官方链接</p>
          ) : null}
        </div>

        <dl className="guideline-meta">
          <div>
            <dt>最后确认日期</dt>
            <dd>{lastChecked}</dd>
          </div>
          <div>
            <dt>募集要项状态</dt>
            <dd>{guidelineStatus}</dd>
          </div>
        </dl>

        {guidelineStatus === '旧年度' ? (
          <p className="guideline-warning">
            这可能是旧年度募集要项，请以最新官网为准。
          </p>
        ) : null}
      </div>
    </section>
  )
}

function getGuidelineStatusClass(status) {
  if (status === '已确认') {
    return 'confirmed'
  }

  if (status === '未发布') {
    return 'unpublished'
  }

  if (status === '旧年度') {
    return 'old'
  }

  return 'unknown'
}

function ApplicationTimeline({ university }) {
  return (
    <section className="timeline-section" aria-label="申请时间线">
      <div className="section-heading">
        <h2>申请时间线</h2>
        <p>仅展示关键时间节点，不会发送真实提醒。</p>
      </div>

      <div className="timeline-grid">
        {timelineFields.map(([key, label], index) => {
          const value = getValue(university[key])
          const isUnknown = value === UNKNOWN

          return (
            <article
              className={isUnknown ? 'timeline-card muted' : 'timeline-card'}
              key={key}
            >
              <div className="timeline-marker" aria-hidden="true">
                {index + 1}
              </div>
              <div>
                <h3>{label}</h3>
                <p>{value}</p>
              </div>
            </article>
          )
        })}
      </div>
    </section>
  )
}

function DetailItem({ label, value, fieldKey, isPdf }) {
  const isUnknown = value === UNKNOWN

  return (
    <article className="detail-item">
      <h3>{label}</h3>
      {fieldKey === 'applicationMaterials' ? (
        <ApplicationMaterials value={value} />
      ) : Array.isArray(value) ? (
        <div className="faculty-list">
          {value.map((faculty) => (
            <div className="faculty-block" key={faculty.name}>
              <strong>{faculty.name}</strong>
              <p>
                {faculty.departments?.length
                  ? faculty.departments.join('、')
                  : UNKNOWN}
              </p>
            </div>
          ))}
        </div>
      ) : isPdf && !isUnknown ? (
        <a href={value} target="_blank" rel="noreferrer">
          查看募集要项PDF
        </a>
      ) : (
        <p className={isUnknown ? 'unknown' : undefined}>{value}</p>
      )}
    </article>
  )
}

function ApplicationMaterials({ value }) {
  if (value === UNKNOWN) {
    return <p className="unknown">{UNKNOWN}</p>
  }

  if (!Array.isArray(value)) {
    return <p>{value}</p>
  }

  return (
    <div className="materials-list">
      {value.map((material, index) => {
        const materialName =
          typeof material === 'string' ? material : material.name || UNKNOWN
        const materialStatus =
          typeof material === 'string' ? UNKNOWN : getMaterialStatus(material.status)

        return (
          <div
            className={`material-card ${getMaterialClassName(materialStatus)}`}
            key={`${materialName}-${index}`}
          >
            <span>{materialStatus}</span>
            <strong>{materialName}</strong>
          </div>
        )
      })}
    </div>
  )
}

export default App
