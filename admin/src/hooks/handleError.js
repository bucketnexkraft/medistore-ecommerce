
const extractLaravelErrors = (errorsObj) => {
    const messages = [];
    const walk = (prefix, val) => {
        if (Array.isArray(val)) {
            val.forEach(v => {
                if (typeof v === 'string') {
                    messages.push(prefix ? `${prefix}: ${v}` : v);
                } else {
                    walk(prefix, v);
                }
            });
        } else if (val && typeof val === 'object') {
            Object.entries(val).forEach(([k, v]) => {
                walk(prefix ? `${prefix}.${k}` : k, v);
            });
        } else if (typeof val === 'string') {
            messages.push(prefix ? `${prefix}: ${val}` : val);
        }
    };
    walk('', errorsObj);
    return messages;
};

export default extractLaravelErrors;