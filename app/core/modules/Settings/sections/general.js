import TimezonePicker from '@/components/TimezonePicker';
import CompanyService from '../services/companyService';
import ColorSelect from '../components/ColorSelect';
import Store from '@/store';

export default {
    // Check if this section can be rendered and accessed, this param IS OPTIONAL (true by default)
    // NOTICE: this route will not be added to VueRouter AT ALL if this check fails
    // MUST be a function that returns a boolean
    accessCheck: async () => Store.getters['user/user'].is_admin === 1,

    scope: 'company',

    order: 0,

    route: {
        // After processing this route will be named as 'settings.exampleSection'
        name: 'Settings.company.general',

        // After processing this route can be accessed via URL 'settings/example'
        path: '/company/general',

        meta: {
            // After render, this section will be labeled as 'Example Section'
            label: 'settings.general',

            // Service class to gather the data from API, should be an instance of Resource class
            service: new CompanyService(),

            // Renderable fields array
            fields: [
                {
                    label: 'settings.company_timezone',
                    key: 'timezone',
                    render: (h, props) => {
                        if (typeof props.currentValue === 'object') {
                            props.currentValue = '';
                        }

                        return h(TimezonePicker, {
                            props: {
                                value: props.currentValue,
                            },
                            on: {
                                onTimezoneChange(ev) {
                                    props.inputHandler(ev);
                                },
                            },
                        });
                    },
                },
                {
                    label: 'field.work_time',
                    key: 'work_time',
                    maxValue: 24,
                    minValue: 0,
                    fieldOptions: {
                        type: 'number',
                        placeholder: 'field.work_time',
                    },
                    tooltipValue: 'tooltip.work_time',
                },
                {
                    label: 'settings.color_interval.label',
                    key: 'color',
                    displayable: store =>
                        'work_time' in store.getters['user/companyData'] && store.getters['user/companyData'].work_time,
                    tooltipValue: 'tooltip.color_intervals',
                    render(h, props) {
                        const defaultConfig = [
                            {
                                start: 0,
                                end: 0.75,
                                color: '#ffb6c2',
                            },
                            {
                                start: 0.76,
                                end: 1,
                                color: '#93ecda',
                            },
                            {
                                start: 1,
                                end: 0,
                                color: '#3cd7b6',
                                isOverTime: true,
                            },
                        ];

                        if (!Array.isArray(props.currentValue)) {
                            'color' in props.companyData
                                ? (props.currentValue = props.companyData.color)
                                : (props.currentValue = defaultConfig);

                            this.inputHandler(props.currentValue);
                        }

                        return h(ColorSelect, {
                            props: {
                                colorsConfig: props.currentValue,
                            },
                            on: {
                                addColorReadiness(data) {
                                    props.inputHandler(
                                        [...props.currentValue, ...data].sort((a, b) => {
                                            return a.start - b.start;
                                        }),
                                    );
                                },
                                onRemoveRelation(index) {
                                    props.currentValue.splice(index, 1);
                                    props.inputHandler(props.currentValue);
                                },
                                setOverTime(data) {
                                    props.inputHandler(data);
                                },
                                reset() {
                                    props.inputHandler(defaultConfig);
                                },
                                setStart(index, newStart) {
                                    props.currentValue[index].start = newStart;
                                    props.inputHandler(props.currentValue);
                                },
                                setEnd(index, newEnd) {
                                    props.currentValue[index].end = newEnd;
                                    props.inputHandler(props.currentValue);
                                },
                            },
                        });
                    },
                },
            ],
        },
    },
};
