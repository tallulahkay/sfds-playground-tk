export class Totals {
	private totals: Map<any, number>;

	constructor()
	{
		this.totals = new Map<any, number>();
	}

	add(
		key: any)
	{
		const keyTotal = this.totals.get(key);

		if (typeof keyTotal === "number") {
			this.totals.set(key, keyTotal + 1);
		} else {
			this.totals.set(key, 1);
		}
	}

	all()
	{
		return Object.fromEntries([...this.totals]);
	}
}
